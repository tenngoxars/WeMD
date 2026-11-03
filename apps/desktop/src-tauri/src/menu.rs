// 应用菜单，对齐 apps/electron/src/menu.ts。只在 macOS 安装：WKWebView 的复制、粘贴、撤销依赖编辑菜单。
// Linux、Windows 与 Electron 版一样窗口里不显示菜单栏，新建、保存快捷键由 bridge.js 监听；
// Linux 上也不能有「粘贴」菜单项，它会走 WebKitGTK 自带粘贴而崩溃。
use tauri::menu::{Menu, MenuEvent, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Emitter, Runtime};
use tauri_plugin_opener::OpenerExt;

/// 前端经 bridge.js 监听这些事件；检查更新由 bridge.js 发请求
const EMITTED: [&str; 4] = ["menu:new-file", "menu:save", "menu:switch-workspace", "menu:check-update"];

pub fn build<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let separator = || PredefinedMenuItem::separator(app);
    let item = |id: &str, text: &str, accelerator: Option<&str>| MenuItem::with_id(app, id, text, true, accelerator);
    let app_menu = Submenu::with_items(
        app,
        "WeMD",
        true,
        &[
            &PredefinedMenuItem::about(app, Some("关于 WeMD"), None)?,
            &separator()?,
            &PredefinedMenuItem::hide(app, Some("隐藏 WeMD"))?,
            &PredefinedMenuItem::hide_others(app, Some("隐藏其他"))?,
            &PredefinedMenuItem::show_all(app, Some("显示全部"))?,
            &separator()?,
            &PredefinedMenuItem::quit(app, Some("退出 WeMD"))?,
        ],
    )?;
    let file = Submenu::with_items(
        app,
        "文件",
        true,
        &[
            &item("menu:new-file", "新建文章", Some("CmdOrCtrl+N"))?,
            &separator()?,
            &item("menu:save", "保存", Some("CmdOrCtrl+S"))?,
            &separator()?,
            &item("menu:switch-workspace", "切换工作区...", None)?,
        ],
    )?;
    let edit = Submenu::with_items(
        app,
        "编辑",
        true,
        &[
            &PredefinedMenuItem::undo(app, Some("撤销"))?,
            &PredefinedMenuItem::redo(app, Some("重做"))?,
            &separator()?,
            &PredefinedMenuItem::cut(app, Some("剪切"))?,
            &PredefinedMenuItem::copy(app, Some("复制"))?,
            &PredefinedMenuItem::paste(app, Some("粘贴"))?,
            &PredefinedMenuItem::select_all(app, Some("全选"))?,
        ],
    )?;
    let view = Submenu::with_items(app, "查看", true, &[&PredefinedMenuItem::fullscreen(app, Some("全屏"))?])?;
    let window = Submenu::with_items(
        app,
        "窗口",
        true,
        &[
            &PredefinedMenuItem::minimize(app, Some("最小化"))?,
            &PredefinedMenuItem::maximize(app, Some("缩放"))?,
            &separator()?,
            &PredefinedMenuItem::bring_all_to_front(app, Some("前置全部窗口"))?,
        ],
    )?;
    let help = Submenu::with_items(
        app,
        "帮助",
        true,
        &[
            &item("menu:check-update", "检查更新...", None)?,
            &separator()?,
            &item("open:https://wemd.app", "访问官网", None)?,
            &item("open:https://github.com/tenngoxars/WeMD", "GitHub 仓库", None)?,
        ],
    )?;
    Menu::with_items(app, &[&app_menu, &file, &edit, &view, &window, &help])
}

pub fn on_event<R: Runtime>(app: &AppHandle<R>, event: MenuEvent) {
    let id = event.id().as_ref();
    if EMITTED.contains(&id) {
        let _ = app.emit(id, ());
    } else if let Some(url) = id.strip_prefix("open:") {
        let _ = app.opener().open_url(url, None::<&str>);
    }
}
