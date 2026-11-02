# WeMD Electron

`apps/electron` 是 WeMD 桌面端外壳，复用 Web 端构建产物，并提供窗口、菜单、文件系统、剪贴板、工作区监听和更新检查等桌面能力。

## 目录结构

```
apps/electron/
├── src/
│   ├── main.ts          # 主进程入口
│   ├── window.ts        # 窗口创建与加载策略
│   ├── menu.ts          # 桌面菜单
│   ├── preload.ts       # 暴露给渲染进程的安全 API
│   ├── updater.ts       # 更新检查
│   ├── ipc/             # IPC 注册与职责拆分
│   ├── watch/           # 工作区递归监听
│   ├── workspace/       # 工作区状态与文件列表逻辑
│   └── utils/           # 桌面端工具函数
├── assets/              # 应用图标等打包资源
├── electron-builder.json
└── package.json
```

## 常用命令

推荐从仓库根目录运行：

```bash
pnpm dev:desktop
pnpm --filter wemd-electron test
pnpm --filter wemd-electron build
```

平台打包命令：

```bash
pnpm --filter wemd-electron run build:mac
pnpm --filter wemd-electron run build:win
pnpm --filter wemd-electron run build:linux
```

## 发布产物

当前打包配置：

- macOS：`zip`，自动发布 Apple Silicon 版本。
- Windows：NSIS 安装包。
- Linux：AppImage。

构建产物输出到 `apps/electron/release/`，不要手工编辑构建产物。
