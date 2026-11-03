// WeMD 桌面端（Tauri 2）：只负责组装插件、命令与主窗口。命令返回值与 Electron IPC 保持同形，供 bridge.js 直接转交前端
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(feature = "automation")]
mod automation;
mod clipboard;
mod download;
mod files;
mod folders;
mod migration;
// 菜单只在 macOS 安装，其余平台仍参与编译检查
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
mod menu;
mod watcher;
mod workspace;

use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_opener::OpenerExt;

/// 只放行 http/https，与 Electron 版一致
#[tauri::command]
fn open_external(url: String, app: AppHandle) {
    if url.starts_with("http://") || url.starts_with("https://") {
        let _ = app.opener().open_url(url, None::<&str>);
    }
}

/// 能否应用内自更新：Linux 只有 AppImage 能替换自身，deb 等系统包交给包管理器
#[tauri::command]
fn updater_supported() -> bool {
    cfg!(any(target_os = "macos", target_os = "windows")) || std::env::var_os("APPIMAGE").is_some()
}

fn main() {
    let builder = tauri::Builder::default()
        // 必须最先注册：第二次启动时聚焦已有窗口后直接退出
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(files::Workspace::default());
    #[cfg(target_os = "macos")]
    let builder = builder.menu(menu::build).on_menu_event(menu::on_event);
    builder
        .invoke_handler(tauri::generate_handler![
            files::workspace_select,
            files::workspace_set,
            files::file_list,
            files::file_read,
            files::file_create,
            files::file_save,
            files::file_rename,
            files::file_delete,
            files::file_reveal,
            folders::folder_create,
            folders::folder_rename,
            folders::folder_move,
            folders::folder_move_folder,
            folders::folder_inspect,
            folders::folder_delete,
            files::theme_read,
            files::theme_write,
            clipboard::clipboard_write_html,
            clipboard::clipboard_write_text,
            clipboard::clipboard_read_image,
            clipboard::clipboard_read_text,
            clipboard::clipboard_image_files,
            clipboard::clipboard_read_image_file,
            open_external,
            updater_supported,
            migration::migration_delete,
        ])
        .setup(|app| {
            let builder = WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
                .title("WeMD")
                .inner_size(1280.0, 800.0)
                .min_inner_size(1100.0, 640.0)
                .maximized(true)
                // 侧边栏拖放走 HTML5 drop，关闭原生拖放接管
                .disable_drag_drop_handler()
                .on_download(download::handle)
                .initialization_script(include_str!("bridge.js"));
            // Electron 设置迁移：必须在页面脚本之前写入 localStorage，挂载时才不会把旧值写回
            let builder = match migration::init_script(app.handle()) {
                Some(script) => builder.initialization_script(script),
                None => builder,
            };
            // 标题栏与 Electron 版一致：macOS 隐藏标题栏保留红绿灯，Windows 无边框由前端画按钮
            #[cfg(target_os = "macos")]
            let builder = builder
                .title_bar_style(tauri::TitleBarStyle::Overlay)
                .hidden_title(true)
                .traffic_light_position(tauri::LogicalPosition::new(20.0, 28.0));
            #[cfg(target_os = "windows")]
            let builder = builder.decorations(false);
            builder.build()?;
            #[cfg(feature = "automation")]
            automation::start(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("WeMD 启动失败");
}
