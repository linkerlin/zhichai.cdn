# IPFSCDN.js

一个基于浏览器的去中心化 CDN，使用 Helia IPFS 实现 P2P 图片分发。

## 功能特性

- 🚀 **自动拦截图片加载**：页面加载时自动拦截所有 `<img>` 标签
- 💾 **本地 IPFS 存储**：将图片存储到浏览器的 Helia IPFS 节点
- 🔄 **智能缓存**：从本地节点加载已存储的图片，减少服务器负载
- 🌐 **P2P 分发**：自动向 IPFS 网络宣告和分发内容
- 📊 **动态监控**：自动处理动态添加的图片元素

## 快速开始

### 1. 在 HTML 中引入

```html
<!DOCTYPE html>
<html>
<head>
    <title>My Page with IPFSCDN</title>
</head>
<body>
    <h1>我的网页</h1>
    
    <!-- 你的图片会被自动处理 -->
    <img src="https://example.com/image1.jpg" alt="图片 1">
    <img src="https://example.com/image2.png" alt="图片 2">
    
    <!-- 在页面底部引入 IPFSCDN.js -->
    <script type="module" src="./ipfscdn.js"></script>
</body>
</html>
```

### 2. 运行演示

```bash
# 克隆仓库
git clone https://github.com/linkerlin/zhichai.cdn.git
cd zhichai.cdn

# 启动本地服务器
python3 -m http.server 8080
# 或者使用 npm
npm start
```

然后在浏览器中打开 `http://localhost:8080/demo.html`

## 工作原理

1. **初始化阶段**
   - 创建本地 Helia IPFS 节点
   - 连接到 IPFS 网络

2. **图片扫描**
   - 扫描页面上所有的 `<img>` 标签
   - 提取图片 URL 并转换为绝对路径

3. **图片处理**
   - 对每张图片检查本地是否已存储
   - 如果未存储：
     - 从原始 URL 获取图片数据
     - 将图片存储到本地 IPFS 节点
     - 获取 IPFS CID（内容标识符）
     - 自动向网络宣告该 CID
   - 如果已存储：
     - 直接从本地 IPFS 节点读取
     - 使用 Blob URL 替换原始 src

4. **动态监控**
   - 使用 MutationObserver 监控 DOM 变化
   - 自动处理新添加的图片

## API 文档

### IPFSCDN 类

```javascript
import ipfscdn from './ipfscdn.js';

// 手动启动（通常会自动启动）
await ipfscdn.start();

// 处理单个图片
const img = document.querySelector('#myImage');
await ipfscdn.processImage(img);

// 停止 IPFS 节点
await ipfscdn.stop();

// 访问 Helia 实例
console.log('Peer ID:', ipfscdn.helia.libp2p.peerId.toString());

// 查看缓存的图片
console.log('Cached images:', ipfscdn.imageCache);
```

### 主要方法

- `init()`: 初始化 Helia IPFS 节点
- `start()`: 启动 IPFSCDN 系统
- `processImage(imgElement)`: 处理单个图片元素
- `interceptImages()`: 拦截页面上所有图片
- `stop()`: 停止并清理 IPFS 节点

## 技术栈

- **Helia** (v6.0.20): 浏览器端 IPFS 实现
- **@helia/unixfs** (v7.0.4): UnixFS 文件系统支持
- **multiformats** (v13.4.2): CID 和多格式支持

## 浏览器兼容性

- Chrome/Edge 90+
- Firefox 88+
- Safari 15+

需要支持：
- ES6 Modules
- Web Workers
- IndexedDB
- WebRTC (用于 P2P 连接)

## 注意事项

1. **CORS 限制**：只能处理允许跨域访问的图片
2. **存储空间**：图片存储在浏览器的 IndexedDB 中，注意存储限制
3. **性能考虑**：首次加载图片时需要下载并存储，可能比直接加载稍慢
4. **网络连接**：需要能够连接到 IPFS 网络的节点

## 开发

```bash
# 安装依赖（可选）
npm install

# 启动开发服务器
npm start
```

## 配置选项

未来版本将支持更多配置选项，如：
- 自定义 IPFS 节点配置
- 图片过滤规则
- 缓存策略
- 预加载选项

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License

## 相关链接

- [Helia 文档](https://helia.io/)
- [IPFS 官网](https://ipfs.io/)
- [项目仓库](https://github.com/linkerlin/zhichai.cdn)
