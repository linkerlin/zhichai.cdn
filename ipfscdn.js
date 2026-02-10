/**
 * IPFSCDN.js - A browser-based CDN using Helia IPFS
 * 
 * This library intercepts image loading on a webpage and stores images
 * in a local Helia IPFS node for P2P distribution and caching.
 */

import { createHelia } from 'https://cdn.jsdelivr.net/npm/helia@6.0.20/+esm';
import { unixfs } from 'https://cdn.jsdelivr.net/npm/@helia/unixfs@7.0.4/+esm';
import { CID } from 'https://cdn.jsdelivr.net/npm/multiformats@13.4.2/+esm';

class IPFSCDN {
  constructor() {
    this.helia = null;
    this.fs = null;
    this.imageCache = new Map(); // URL -> CID mapping
    this.processingQueue = new Map(); // Track images being processed
    this.initialized = false;
    this.initPromise = null;
  }

  /**
   * Initialize the Helia IPFS node
   */
  async init() {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        console.log('[IPFSCDN] Initializing Helia node...');
        this.helia = await createHelia();
        this.fs = unixfs(this.helia);
        this.initialized = true;
        console.log('[IPFSCDN] Helia node initialized successfully');
        console.log('[IPFSCDN] Node PeerID:', this.helia.libp2p.peerId.toString());
      } catch (error) {
        console.error('[IPFSCDN] Failed to initialize Helia:', error);
        throw error;
      }
    })();

    return this.initPromise;
  }

  /**
   * Convert relative URL to absolute URL
   */
  toAbsoluteURL(url) {
    if (!url) return null;
    
    // Already absolute
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
      return url;
    }
    
    // Convert relative to absolute
    const a = document.createElement('a');
    a.href = url;
    return a.href;
  }

  /**
   * Fetch image data as Uint8Array
   */
  async fetchImageData(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    } catch (error) {
      console.error(`[IPFSCDN] Error fetching image ${url}:`, error);
      throw error;
    }
  }

  /**
   * Store image in IPFS and return CID
   */
  async storeImage(url, imageData) {
    try {
      console.log(`[IPFSCDN] Storing image in IPFS: ${url}`);
      
      // Add file to IPFS
      const cid = await this.fs.addBytes(imageData);
      
      console.log(`[IPFSCDN] Image stored with CID: ${cid.toString()}`);
      
      // Cache the mapping
      this.imageCache.set(url, cid.toString());
      
      // Announce the CID to the network (Helia does this automatically)
      // The libp2p layer will propagate our interest in this content
      
      return cid;
    } catch (error) {
      console.error(`[IPFSCDN] Error storing image:`, error);
      throw error;
    }
  }

  /**
   * Retrieve image data from IPFS by CID
   */
  async retrieveImage(cid) {
    try {
      const chunks = [];
      for await (const chunk of this.fs.cat(cid)) {
        chunks.push(chunk);
      }
      
      // Concatenate chunks
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }
      
      return result;
    } catch (error) {
      console.error(`[IPFSCDN] Error retrieving image from IPFS:`, error);
      throw error;
    }
  }

  /**
   * Check if we have the image in local IPFS node
   */
  async hasImage(cid) {
    try {
      // Try to stat the file - if it exists locally, this will be fast
      await this.fs.stat(cid);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Create a blob URL from image data
   */
  createBlobURL(imageData, mimeType = 'image/png') {
    const blob = new Blob([imageData], { type: mimeType });
    return URL.createObjectURL(blob);
  }

  /**
   * Detect MIME type from URL or data
   */
  detectMimeType(url) {
    const extension = url.split('.').pop().toLowerCase().split('?')[0];
    const mimeTypes = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'svg': 'image/svg+xml',
      'bmp': 'image/bmp',
      'ico': 'image/x-icon'
    };
    return mimeTypes[extension] || 'image/png';
  }

  /**
   * Process a single image element
   */
  async processImage(img) {
    const originalSrc = img.getAttribute('src');
    if (!originalSrc) return;

    const absoluteURL = this.toAbsoluteURL(originalSrc);
    if (!absoluteURL || absoluteURL.startsWith('data:') || absoluteURL.startsWith('blob:')) {
      return; // Skip data URLs and blob URLs
    }

    // Check if already processing
    if (this.processingQueue.has(absoluteURL)) {
      console.log(`[IPFSCDN] Already processing: ${absoluteURL}`);
      return;
    }

    this.processingQueue.set(absoluteURL, true);

    try {
      // Check if we already have the CID cached
      let cidString = this.imageCache.get(absoluteURL);
      
      if (cidString) {
        console.log(`[IPFSCDN] Using cached CID for ${absoluteURL}: ${cidString}`);
        const cid = CID.parse(cidString);
        
        // Check if we have it locally
        const hasLocal = await this.hasImage(cid);
        if (hasLocal) {
          // Retrieve from local IPFS and update img src
          const imageData = await this.retrieveImage(cid);
          const mimeType = this.detectMimeType(absoluteURL);
          const blobURL = this.createBlobURL(imageData, mimeType);
          img.src = blobURL;
          img.dataset.ipfsCid = cidString;
          console.log(`[IPFSCDN] Image loaded from local IPFS: ${cidString}`);
          return;
        }
      }

      // Fetch the image from original URL
      console.log(`[IPFSCDN] Fetching image: ${absoluteURL}`);
      const imageData = await this.fetchImageData(absoluteURL);

      // Store in IPFS
      const cid = await this.storeImage(absoluteURL, imageData);
      cidString = cid.toString();

      // Create blob URL and update image
      const mimeType = this.detectMimeType(absoluteURL);
      const blobURL = this.createBlobURL(imageData, mimeType);
      img.src = blobURL;
      img.dataset.ipfsCid = cidString;
      
      console.log(`[IPFSCDN] Image processed and stored: ${cidString}`);
    } catch (error) {
      console.error(`[IPFSCDN] Failed to process image ${absoluteURL}:`, error);
      // Keep original src on error
    } finally {
      this.processingQueue.delete(absoluteURL);
    }
  }

  /**
   * Intercept and process all images on the page
   */
  async interceptImages() {
    await this.init();

    console.log('[IPFSCDN] Scanning page for images...');
    
    // Get all existing images
    const images = document.querySelectorAll('img');
    console.log(`[IPFSCDN] Found ${images.length} images to process`);

    // Process all images
    const promises = Array.from(images).map(img => this.processImage(img));
    await Promise.allSettled(promises);

    // Set up MutationObserver to catch dynamically added images
    this.observeNewImages();
    
    console.log('[IPFSCDN] Initial image scan complete');
  }

  /**
   * Observe DOM for new images being added
   */
  observeNewImages() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeName === 'IMG') {
            this.processImage(node);
          } else if (node.querySelectorAll) {
            const images = node.querySelectorAll('img');
            images.forEach(img => this.processImage(img));
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    console.log('[IPFSCDN] Observing DOM for new images');
  }

  /**
   * Start the IPFSCDN system
   */
  async start() {
    console.log('[IPFSCDN] Starting IPFSCDN.js...');
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      await new Promise(resolve => {
        document.addEventListener('DOMContentLoaded', resolve);
      });
    }

    await this.interceptImages();
    
    console.log('[IPFSCDN] IPFSCDN.js is now active');
  }

  /**
   * Stop and cleanup
   */
  async stop() {
    if (this.helia) {
      console.log('[IPFSCDN] Stopping Helia node...');
      await this.helia.stop();
      this.initialized = false;
      console.log('[IPFSCDN] Helia node stopped');
    }
  }
}

// Create global instance
const ipfscdn = new IPFSCDN();

// Auto-start when script loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    ipfscdn.start().catch(console.error);
  });
} else {
  ipfscdn.start().catch(console.error);
}

// Export for manual control
export default ipfscdn;
