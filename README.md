<p align="center">
  <img src="apps/web/public/favicon-dark.svg" width="72" height="72" alt="WeMD" />
</p>

<h1 align="center">WeMD</h1>

<p align="center">
  用 Markdown 写公众号，复制即排好版。<br>
  本地优先，无需登录，开源免费。
</p>

<p align="center">
  <a href="https://edit.wemd.app">在线使用</a> ·
  <a href="https://github.com/tenngoxars/WeMD/releases/latest">下载桌面版</a> ·
  <a href="https://wemd.app/docs">使用文档</a> ·
  <a href="https://wemd.app">官网</a>
</p>

<p align="center">
  <a href="https://github.com/tenngoxars/WeMD/releases/latest"><img src="https://img.shields.io/github/v/release/tenngoxars/WeMD?label=%E6%9C%80%E6%96%B0%E7%89%88%E6%9C%AC&color=047857" alt="最新版本" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-047857" alt="MIT License" /></a>
</p>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/assets/screenshot-dark.webp" />
  <img src=".github/assets/screenshot-light.webp" alt="WeMD 编辑器界面：左侧 Markdown 源码，右侧公众号排版预览" />
</picture>

## 功能

**写作**

- 支持 GFM、表格、代码高亮、数学公式、Mermaid 图表和滑动图组
- 一键格式化：中英文之间加空格、标点转全角、引号转直角引号「」、清理多余空白，每条规则可单独开关
- 搜索替换支持正则和全词匹配

**排版**

- 内置十余款文章主题，可用可视化设计器调整，也可直接写 CSS
- 预览公众号深色模式下的效果，还原度达 98% 以上（[算法原理](https://wemd.app/docs/reference/dark-mode-algorithm.html)）
- 界面支持亮色和深色两种模式

**AI 写作辅助**

- 选中一段文字改写：润色、精简、口语化、换语气，或输入自定义要求
- 全文审阅：从开头、结构、节奏、表达和结尾五个方面给出修改建议
- 起标题：按多个方向生成标题候选
- 填入自己的 API Key 即可使用，请求从浏览器直接发到服务商，不经过 WeMD。支持 DeepSeek、Kimi、通义千问、硅基流动、模力方舟、OpenAI、OpenRouter 和自定义 OpenAI 兼容服务

**发布**

- 一键复制到公众号，粘贴后尽量保持预览效果
- 导出 HTML，或按手机宽度导出 PNG 长图
- 图床支持官方图床、七牛云、阿里云、腾讯云和 S3 兼容服务

**本地优先**

- 文章存放在浏览器或你选择的本地文件夹里，无需注册登录
- 本地文件夹模式支持多级目录，文件树可一键展开或折叠

## 开始使用

### 在线使用

打开 [edit.wemd.app](https://edit.wemd.app) 即可写作，文章只保存在本地。

网页版支持 PWA：在 Chrome 或 Edge 地址栏点击安装图标，就能把 WeMD 安装到桌面或手机主屏，安装后可离线写作（上传图片仍需联网）。

### 桌面版

从 [Releases](https://github.com/tenngoxars/WeMD/releases/latest) 下载对应平台的安装包：

| 平台                   | 安装包                        |
| ---------------------- | ----------------------------- |
| macOS（Apple Silicon） | `WeMD-<版本号>-arm64-mac.zip` |
| Windows                | `WeMD.Setup.<版本号>.exe`     |
| Linux                  | `WeMD-<版本号>.AppImage`      |

Intel Mac 暂无安装包，可以使用网页版或从源码构建。

<details>
<summary>首次打开遇到提示？</summary>

- **macOS 提示「应用已损坏」**：在终端执行 `xattr -cr /Applications/WeMD.app`
- **Windows 提示「未知发布者」**：点击「更多信息」，再点「仍要运行」
- **Linux 无法运行**：先设置可执行权限 `chmod +x WeMD-<版本号>.AppImage`

</details>

### Docker 部署

```bash
docker compose pull
docker compose up -d
```

启动后访问 `http://localhost:8080`。默认使用 `ghcr.io/tenngoxars/wemd-web:latest` 镜像，需要固定版本时：

```bash
WEMD_IMAGE=ghcr.io/tenngoxars/wemd-web:<版本号> docker compose up -d
```

#### 使用「本地文件夹」存储

浏览器只在 HTTPS 或 `localhost` 下开放读写本地文件夹的能力，且需要 Chrome、Edge 等 Chromium 内核浏览器。通过 `http://服务器IP:8080` 访问时，存储模式里的「本地文件夹」不可用，只能使用浏览器存储。

- **部署在自己电脑上**：用 `http://localhost:8080` 访问即可。
- **部署在服务器上，有域名**：用 Caddy、Nginx 等反向代理配置 HTTPS。
- **只在局域网使用，没有域名**：在 Chrome 打开 `chrome://flags/#unsafely-treat-insecure-origin-as-secure`，填入 `http://服务器IP:8080` 并重启浏览器。每台电脑需单独设置。

## 参与开发

欢迎提交 [Issue](https://github.com/tenngoxars/WeMD/issues) 和 Pull Request。本地开发、项目结构和提交前检查见 [贡献指南](CONTRIBUTING.md)。

## 支持 WeMD

WeMD 会继续保持免费、开源。目前官方图床的免费存储空间逐渐吃紧，如果这个项目对你有所帮助，欢迎通过微信或支付宝自愿支持。收到的支持将优先用于图片存储、带宽及项目持续维护。

<p align="center">
  <img src=".github/assets/wechat-pay.jpg" width="220" alt="微信支付收款码" />
  <img src=".github/assets/alipay.jpg" width="220" alt="支付宝收款码" />
</p>

感谢每一份支持，也请量力而行。

## 致谢

深色模式预览算法参考了微信官方开源的 [wechatjs/mp-darkmode](https://github.com/wechatjs/mp-darkmode)，感谢微信团队。

## License

[MIT](LICENSE) © WeMD Team
