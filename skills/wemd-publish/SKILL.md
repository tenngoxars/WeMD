---
name: wemd-publish
description: 将本地 Markdown 渲染为微信公众号兼容富文本，并生成可在常规浏览器中点击复制的自包含页面；适用于选择 WeMD 主题、检查 HTML 或准备手动粘贴公众号的请求，不负责登录、保存或发布公众号草稿。
---

# WeMD 公众号排版

使用此 Skill 将一篇本地 Markdown 交给仓库中的 WeMD CLI。Skill 只编排 CLI；不要自行解析 Markdown、内联 CSS、直接写系统剪贴板或上传图片。

## 选择命令

- 用户只要求生成 HTML 或希望先检查结果时，运行 `render`。
- 用户明确要可直接粘贴的富文本时，默认运行 `copy`；它会保留 render 产物，并生成单文件 `<stem>.copy.html`。默认不打开浏览器；用户要求打开时再传 `--open`。
- 不传主题参数时，CLI 使用文章 frontmatter 中的主题；若没有 frontmatter，则使用内置默认主题。
- 内置或工作区主题传 `--theme <reference>`，例如 `builtin:modern-editorial` 或 `workspace:team-style`。
- 明确 CSS 文件传 `--theme-file <绝对 CSS 路径>`。不要同时传 `--theme` 和 `--theme-file`。

执行文章命令前，先将文章解析为绝对路径。CLI 默认将所有产物写到输入 Markdown 所在目录；只有用户要求集中到其他位置时，才传入绝对 `--out-dir`。runner 会保留调用者当前目录，因此不要依赖相对文章路径。从任意当前目录，通过本 Skill 所在目录的 runner 调用：

```bash
node <Skill目录>/scripts/run.mjs render /absolute/path/article.md --json
node <Skill目录>/scripts/run.mjs copy /absolute/path/article.md --theme builtin:modern-editorial --json
node <Skill目录>/scripts/run.mjs copy /absolute/path/article.md --theme builtin:modern-editorial --open
node <Skill目录>/scripts/run.mjs render /absolute/path/article.md --theme-file /absolute/path/theme.css --out-dir /absolute/path/wemd-output --json
```

若运行环境是否就绪未知，先执行：

```bash
node <Skill目录>/scripts/run.mjs doctor --json
```

## 结果与边界

读取 CLI JSON report，向用户返回 `fragment`、`preview`、`report`，以及 copy 命令生成的 `copy` 路径。未指定 `--out-dir` 时，这些文件应与输入 Markdown 位于同一目录。`copy.html` 是完全自包含的浏览器复制页；它不启动服务器、不占端口、不通过 `fetch()` 读取 fragment。

- CLI 完成 `copy` 只说明复制页面已生成；只有用户点击页面按钮且页面显示“复制成功”，才说明富文本已写入系统剪贴板。不得声称已登录、保存或发布到公众号。
- 默认向用户返回 copy 页绝对路径和手动打开方式。只有用户明确要求时才传 `--open`；自动打开失败时仍返回文件路径，不把生成失败与打开失败混为一谈。
- `copy` 返回退出码 4 时，读取 report 中的 `errors`，返回已生成的阻断页路径并说明复制按钮已禁用；该页面不会嵌入未通过安全检查的正文。
- 退出码 4 表示文章含本地或不安全资源等发布安全问题。说明需要用户将资源改为可公开访问的 HTTPS 地址或移除它；不要隐式上传资源。
- 最后仍需用户在微信公众号后台手动粘贴、保存草稿并重新打开确认。

首次在一台机器上使用时，运行 `node <Skill目录>/scripts/install.mjs`。默认安装器会在仓库内执行冻结的筛选依赖安装、构建 Core 和 CLI、下载锁定的 Playwright Chromium（Chromium 仍负责 Markdown/CSS/公式等 DOM 渲染），通过 doctor 后再建立指向本仓库 Skill 的符号链接。仅在已确认这些依赖与构建产物就绪时，才使用 `--skip-deps`；它只执行就绪检查与链接。
