# IPFSCDN.js

一个基于浏览器的去中心化 CDN，使用 Helia IPFS 实现 P2P 图片分发与缓存。

## 功能特性

- 🚀 **自动拦截图片加载**：页面加载时拦截所有 `<img>` 标签
- 💾 **本地 IPFS 存储**：将图片存到浏览器内的 Helia IPFS 节点
- 🔄 **URL→CID 缓存**：使用 localStorage 记录映射，刷新后仍可命中
- 🌐 **网关 + P2P 兜底**：支持 IPFS 网关 URL，并自动尝试公共网关
- 🟢 **处理状态指示**：图片右下角显示加载/本地/远程状态点
- 📊 **动态监控**：自动处理新增的图片节点

## 安装

### 方式一：直接使用文件

把 `ipfscdn.js` 放到你的站点下，然后在页面底部引入：

```html
<script type="module" src="./ipfscdn.js"></script>
```

### 方式二：npm

```bash
npm install ipfscdn
```

在本地开发环境中引用：

```html
<script type="module" src="./node_modules/ipfscdn/ipfscdn.js"></script>
```

> 该库是纯浏览器 ESM 文件，适合直接在浏览器中运行。

## 快速开始

最小可用示例：

```html
<!DOCTYPE html>
<html>
<head>
   <meta charset="UTF-8">
   <title>IPFSCDN Demo</title>
</head>
<body>
   <img src="https://example.com/image1.jpg" alt="image 1">
   <img src="https://example.com/image2.png" alt="image 2">

   <script type="module" src="./ipfscdn.js"></script>
</body>
</html>
```

默认会自动启动并处理所有图片，无需手动调用。

## 示例

本仓库包含 [example.html](example.html)（带验证面板）和 [demo.html](demo.html)。运行本地服务器：

```bash
npm start
```

然后打开：

- `http://localhost:8080/example.html`
- `http://localhost:8080/demo.html`

## 运行机制

1. 初始化 Helia IPFS 节点
2. 扫描页面所有 `<img>`
3. 将图片 URL 转为绝对路径并建立 `URL → CID` 映射
4. 优先从本地 IPFS 读取，未命中则回源并写入 IPFS
5. 对包含 `/ipfs/<cid>` 的 URL，先尝试 P2P 拉取，失败再用网关
6. 通过 `MutationObserver` 监听新图片

## 使用方式

### 自动模式（默认）

只需引入脚本即可：

```html
<script type="module" src="./ipfscdn.js"></script>
```

### 手动模式

```html
<script type="module">
   import ipfscdn from './ipfscdn.js';
   window.ipfscdn = ipfscdn; // 方便调试

   await ipfscdn.start();

   const img = document.querySelector('#myImage');
   await ipfscdn.processImage(img);

   console.log('Peer ID:', ipfscdn.helia.libp2p.peerId.toString());
   console.log('Cache:', ipfscdn.imageCache);
</script>
```

## 数据标记

处理后的图片会带上以下属性：

- `data-ipfs-cid`：图片对应的 CID
- `data-ipfs-original-url`：原始绝对 URL
- `data-ipfs-source`：`local` 或 `remote`

## API

主要方法：

- `init()`：初始化 Helia
- `start()`：启动拦截流程（含初始化和扫描）
- `processImage(imgElement)`：处理单个图片
- `interceptImages()`：扫描并处理当前页面所有图片
- `stop()`：停止并清理 Helia 节点

## 注意事项

- **CORS**：图片源必须允许跨域访问，否则无法读取数据。
- **浏览器存储**：图片存入 IndexedDB，受浏览器配额限制。
- **首屏延迟**：首次会下载并写入 IPFS，速度可能慢于直连。
- **网关可用性**：公共网关可能有限流，建议使用可控网关。

## 开发

```bash
npm start
```

## 许可证

MIT License

## 相关链接

- [Helia 文档](https://helia.io/)
- [IPFS 官网](https://ipfs.io/)
- [项目仓库](https://github.com/linkerlin/zhichai.cdn)
