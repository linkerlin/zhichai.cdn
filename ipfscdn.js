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
    this.ipfsFetchTimeoutMs = 8000;
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
    try {
      // Remove query parameters first
      const urlWithoutQuery = url.split('?')[0];
      
      // Check if URL has a file extension
      const lastDotIndex = urlWithoutQuery.lastIndexOf('.');
      const lastSlashIndex = urlWithoutQuery.lastIndexOf('/');
      
      // Only extract extension if dot comes after last slash
      if (lastDotIndex > lastSlashIndex && lastDotIndex !== -1) {
        const extension = urlWithoutQuery.substring(lastDotIndex + 1).toLowerCase();
        
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
        
        if (mimeTypes[extension]) {
          return mimeTypes[extension];
        }
      }
    } catch (error) {
      console.warn('[IPFSCDN] Error detecting MIME type:', error);
    }
    
    // Default to PNG if unable to detect
    return 'image/png';
  }

  /**
   * Extract an IPFS CID from a URL if present
   */
  extractCidFromUrl(url) {
    try {
      if (!url) return null;
      if (url.startsWith('ipfs://')) {
        return url.replace('ipfs://', '').split('/')[0] || null;
      }

      const match = url.match(/\/ipfs\/([^/?#]+)/i);
      return match ? match[1] : null;
    } catch (error) {
      console.warn('[IPFSCDN] Error extracting CID from URL:', error);
      return null;
    }
  }

  /**
   * Try to fetch image data directly from the IPFS network by CID
   */
  async fetchImageDataFromIpfs(cidString) {
    const cid = CID.parse(cidString);

    const timeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('IPFS fetch timeout')), this.ipfsFetchTimeoutMs);
    });

    const fetchTask = (async () => {
      const chunks = [];
      for await (const chunk of this.fs.cat(cid)) {
        chunks.push(chunk);
      }

      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }

      return result;
    })();

    return Promise.race([fetchTask, timeout]);
  }

  /**
   * Inject status indicator CSS styles (once)
   */
  _injectIndicatorStyles() {
    if (document.getElementById('ipfscdn-indicator-styles')) return;
    const style = document.createElement('style');
    style.id = 'ipfscdn-indicator-styles';
    style.textContent = `
      .ipfscdn-wrapper {
        position: relative;
        display: inline-block;
      }
      .ipfscdn-indicator {
        position: absolute;
        bottom: 8px;
        right: 8px;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        z-index: 10;
        pointer-events: none;
        transition: background-color 0.3s ease;
      }
      .ipfscdn-indicator.loading {
        background: #3b82f6;
        animation: ipfscdn-pulse 1s infinite;
      }
      .ipfscdn-indicator.local {
        background: #3b82f6;
        animation: none;
      }
      .ipfscdn-indicator.remote {
        background: #f59e0b;
        animation: none;
      }
      @keyframes ipfscdn-pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.6; transform: scale(1.1); }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Add or update status indicator dot on an image
   * @param {HTMLImageElement} img
   * @param {'loading'|'local'|'remote'} status
   */
  setIndicator(img, status) {
    this._injectIndicatorStyles();

    // Wrap image if not already wrapped
    let wrapper = img.parentElement;
    if (!wrapper || !wrapper.classList.contains('ipfscdn-wrapper')) {
      wrapper = document.createElement('span');
      wrapper.className = 'ipfscdn-wrapper';
      // Copy the image's display-level styling onto the wrapper
      wrapper.style.display = 'inline-block';
      wrapper.style.width = img.offsetWidth ? img.offsetWidth + 'px' : '100%';
      wrapper.style.maxWidth = '100%';
      img.parentNode.insertBefore(wrapper, img);
      wrapper.appendChild(img);
    }

    // Create or find indicator
    let dot = wrapper.querySelector('.ipfscdn-indicator');
    if (!dot) {
      dot = document.createElement('span');
      dot.className = 'ipfscdn-indicator';
      wrapper.appendChild(dot);
    }

    dot.className = 'ipfscdn-indicator ' + status;
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

    // Show loading indicator
    this.setIndicator(img, 'loading');

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
          img.dataset.ipfsSource = 'local';
          this.setIndicator(img, 'local');
          console.log(`[IPFSCDN] Image loaded from local IPFS: ${cidString}`);
          return;
        }
      }

      // Try to fetch directly from IPFS if this is an IPFS gateway URL
      const cidFromUrl = this.extractCidFromUrl(absoluteURL);
      let imageData = null;
      let source = 'remote';
      if (cidFromUrl) {
        try {
          console.log(`[IPFSCDN] Fetching image from IPFS network: ${cidFromUrl}`);
          imageData = await this.fetchImageDataFromIpfs(cidFromUrl);
          source = 'local'; // fetched via IPFS network
        } catch (error) {
          console.warn(`[IPFSCDN] IPFS network fetch failed, falling back to gateway: ${cidFromUrl}`);
        }
      }

      // Fetch the image from original URL as a fallback
      if (!imageData) {
        console.log(`[IPFSCDN] Fetching image: ${absoluteURL}`);
        imageData = await this.fetchImageData(absoluteURL);
        source = 'remote';
      }

      // Store in IPFS
      const cid = await this.storeImage(absoluteURL, imageData);
      cidString = cid.toString();

      // Image is now stored locally, update source accordingly
      source = 'local';

      // Create blob URL and update image
      const mimeType = this.detectMimeType(absoluteURL);
      const blobURL = this.createBlobURL(imageData, mimeType);
      img.src = blobURL;
      img.dataset.ipfsCid = cidString;
      img.dataset.ipfsSource = source;
      this.setIndicator(img, source);
      
      console.log(`[IPFSCDN] Image processed and stored: ${cidString}`);
    } catch (error) {
      console.error(`[IPFSCDN] Failed to process image ${absoluteURL}:`, error);
      this.setIndicator(img, 'remote');
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
