# IPFSCDN.js 使用指南

## 目录
1. [快速开始](#快速开始)
2. [核心概念](#核心概念)
3. [详细使用](#详细使用)
4. [API 参考](#api-参考)
5. [常见问题](#常见问题)
6. [最佳实践](#最佳实践)

## 快速开始

### 基本用法

在 HTML 页面的底部添加一行代码：

```html
<script type="module" src="./ipfscdn.js"></script>
```

就这么简单！IPFSCDN.js 会自动：
- 初始化本地 IPFS 节点
- 扫描页面上所有图片
- 将图片存储到 IPFS
- 从本地节点加载已缓存的图片

### 完整示例

```html
<!DOCTYPE html>
<html>
<head>
    <title>我的网页</title>
</head>
<body>
    <h1>欢迎</h1>
    
    <!-- 这些图片会被自动处理 -->
    <img src="https://example.com/logo.png" alt="Logo">
    <img src="/images/banner.jpg" alt="Banner">
    <img src="photo.png" alt="Photo">
    
    <!-- 引入 IPFSCDN.js -->
    <script type="module" src="./ipfscdn.js"></script>
</body>
</html>
```

## 核心概念

### 工作流程

1. **页面加载时**
   - IPFSCDN.js 初始化 Helia IPFS 节点
   - 扫描所有 `<img>` 标签

2. **对每张图片**
   - 转换相对 URL 为绝对 URL
   - 检查是否已在本地 IPFS 存储
   - 如果未存储：获取图片 → 存储到 IPFS → 获取 CID
   - 如果已存储：直接从 IPFS 读取
   - 使用 Blob URL 替换原始 src

3. **持续监控**
   - 自动处理动态添加的新图片
   - 维护 URL → CID 映射缓存

### 关键特性

- **零配置**：引入即用，无需任何配置
- **自动化**：全自动处理所有图片
- **P2P 分发**：自动向 IPFS 网络宣告内容
- **本地缓存**：已存储的图片直接从本地加载
- **动态支持**：自动处理 JavaScript 添加的图片

## 详细使用

### 手动控制

如果你需要更多控制，可以手动操作：

```html
<script type="module">
  import ipfscdn from './ipfscdn.js';
  
  // 访问全局实例
  window.ipfscdn = ipfscdn;
  
  // 等待初始化完成
  await ipfscdn.init();
  console.log('IPFS 节点已初始化');
  
  // 手动处理特定图片
  const img = document.querySelector('#myImage');
  await ipfscdn.processImage(img);
  
  // 查看节点信息
  console.log('Peer ID:', ipfscdn.helia.libp2p.peerId.toString());
  
  // 查看已缓存的图片
  console.log('缓存映射:', ipfscdn.imageCache);
</script>
```

### 防止自动启动

如果你想完全手动控制，修改 `ipfscdn.js` 的最后部分：

```javascript
// 注释掉自动启动代码
// if (document.readyState === 'loading') {
//   document.addEventListener('DOMContentLoaded', () => {
//     ipfscdn.start().catch(console.error);
//   });
// } else {
//   ipfscdn.start().catch(console.error);
// }

// 仅导出，不自动启动
export default ipfscdn;
```

然后手动启动：

```javascript
import ipfscdn from './ipfscdn.js';
await ipfscdn.start();
```

### 监听事件

监听图片处理完成：

```javascript
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === 'attributes' && 
        mutation.attributeName === 'data-ipfs-cid') {
      const img = mutation.target;
      const cid = img.dataset.ipfsCid;
      console.log('图片已处理，CID:', cid);
    }
  });
});

document.querySelectorAll('img').forEach(img => {
  observer.observe(img, { attributes: true });
});
```

## API 参考

### IPFSCDN 类

#### 构造函数

```javascript
const ipfscdn = new IPFSCDN();
```

#### 方法

##### `init()`
初始化 Helia IPFS 节点。

```javascript
await ipfscdn.init();
```

##### `start()`
启动完整的 IPFSCDN 系统（初始化 + 拦截图片）。

```javascript
await ipfscdn.start();
```

##### `stop()`
停止并清理 IPFS 节点。

```javascript
await ipfscdn.stop();
```

##### `processImage(imgElement)`
处理单个图片元素。

- **参数**: `imgElement` - DOM img 元素
- **返回**: Promise<void>

```javascript
const img = document.querySelector('#myImage');
await ipfscdn.processImage(img);
```

##### `toAbsoluteURL(url)`
将相对 URL 转换为绝对 URL。

- **参数**: `url` - 相对或绝对 URL
- **返回**: 绝对 URL 字符串

```javascript
const absoluteUrl = ipfscdn.toAbsoluteURL('../images/photo.jpg');
```

##### `fetchImageData(url)`
从 URL 获取图片数据。

- **参数**: `url` - 图片 URL
- **返回**: Promise<Uint8Array>

```javascript
const imageData = await ipfscdn.fetchImageData('https://example.com/image.png');
```

##### `storeImage(url, imageData)`
将图片存储到 IPFS。

- **参数**: 
  - `url` - 图片 URL
  - `imageData` - Uint8Array 格式的图片数据
- **返回**: Promise<CID>

```javascript
const cid = await ipfscdn.storeImage(url, imageData);
console.log('CID:', cid.toString());
```

##### `retrieveImage(cid)`
从 IPFS 检索图片。

- **参数**: `cid` - IPFS CID 对象
- **返回**: Promise<Uint8Array>

```javascript
const imageData = await ipfscdn.retrieveImage(cid);
```

##### `hasImage(cid)`
检查本地是否有该 CID 的图片。

- **参数**: `cid` - IPFS CID 对象
- **返回**: Promise<boolean>

```javascript
const exists = await ipfscdn.hasImage(cid);
```

#### 属性

- `helia`: Helia 实例（初始化后可用）
- `fs`: UnixFS 实例（初始化后可用）
- `imageCache`: Map<URL, CID> - URL 到 CID 的映射
- `initialized`: boolean - 是否已初始化

## 常见问题

### Q: 为什么有些图片无法加载？

**A**: 可能的原因：
1. **CORS 限制**：图片服务器不允许跨域访问
2. **网络问题**：无法连接到原始服务器
3. **图片格式不支持**：极少数特殊格式

**解决方案**：
- 确保图片服务器支持 CORS
- 检查浏览器控制台的错误信息
- 对于本地测试，使用本地服务器（如 `python3 -m http.server`）

### Q: 图片存储在哪里？

**A**: 图片存储在浏览器的 IndexedDB 中，由 Helia 管理。每个域名有独立的存储空间。

### Q: 存储空间有限制吗？

**A**: 是的，浏览器对 IndexedDB 有存储配额限制，通常为几十 MB 到几 GB 不等，取决于浏览器和系统。

### Q: 如何清除缓存？

**A**: 清除浏览器数据即可：
```javascript
// 或在代码中
await ipfscdn.stop();
// 然后清除浏览器的 IndexedDB
```

### Q: 首次加载为什么比较慢？

**A**: 首次加载需要：
1. 初始化 IPFS 节点
2. 从原始 URL 下载图片
3. 存储到 IPFS

后续访问会直接从本地加载，速度会快很多。

### Q: 能否配置 IPFS 节点？

**A**: 当前版本使用默认配置。未来版本将支持自定义配置。

### Q: 如何调试？

**A**: 打开浏览器控制台，IPFSCDN 会输出详细的日志信息。

## 最佳实践

### 1. 在页面底部引入

```html
<body>
  <!-- 页面内容 -->
  
  <!-- 在最后引入，确保 DOM 已加载 -->
  <script type="module" src="./ipfscdn.js"></script>
</body>
```

### 2. 使用本地服务器测试

```bash
# Python
python3 -m http.server 8080

# Node.js
npx http-server -p 8080

# PHP
php -S localhost:8080
```

### 3. 监控图片处理状态

```javascript
// 添加处理状态指示器
document.querySelectorAll('img').forEach(img => {
  img.addEventListener('load', () => {
    if (img.dataset.ipfsCid) {
      console.log('从 IPFS 加载:', img.dataset.ipfsCid);
    }
  });
});
```

### 4. 优雅降级

如果 IPFS 初始化失败，图片仍会从原始 URL 加载：

```javascript
try {
  await ipfscdn.start();
} catch (error) {
  console.warn('IPFSCDN 启动失败，使用原始图片源:', error);
  // 图片仍然可以正常显示
}
```

### 5. 生产环境建议

- 为重要图片保留原始 `src`
- 监控存储配额使用情况
- 定期清理不需要的缓存
- 考虑用户的网络状况

### 6. 性能优化

```javascript
// 对大量图片，可以分批处理
const images = Array.from(document.querySelectorAll('img'));
const batchSize = 5;

for (let i = 0; i < images.length; i += batchSize) {
  const batch = images.slice(i, i + batchSize);
  await Promise.allSettled(
    batch.map(img => ipfscdn.processImage(img))
  );
}
```

## 技术细节

### 浏览器兼容性

- Chrome/Edge 90+
- Firefox 88+
- Safari 15+

### 依赖项

- Helia 6.0.20
- @helia/unixfs 7.0.4
- multiformats 13.4.2

### 网络协议

IPFSCDN 使用以下协议连接到 IPFS 网络：
- WebRTC (用于浏览器间 P2P)
- WebSocket (用于连接 IPFS 节点)
- WebTransport (如果支持)

## 示例文件

项目包含以下示例：

1. **demo.html** - 完整功能演示，包含控制台和状态监控
2. **example.html** - 基本使用示例
3. **test-local.html** - 使用 Canvas 生成的本地测试

## 贡献

欢迎提交问题和改进建议！

## 许可证

MIT License
