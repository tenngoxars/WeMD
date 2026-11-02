// WeMD 桌面端（Tauri 2 原型）：命令返回值与 Electron IPC 保持同形，供 bridge.js 直接转交前端
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(feature = "automation")]
mod automation;
mod workspace;

use serde::Deserialize;
use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, State, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;

#[derive(Default)]
struct Workspace(Mutex<Option<PathBuf>>);

impl Workspace {
    fn get(&self) -> Option<PathBuf> {
        self.0.lock().unwrap().clone()
    }
}

fn fail(error: impl ToString) -> Value {
    json!({ "success": false, "error": error.to_string() })
}

/// 取工作区并校验目标路径在其内部
fn guard(state: &Workspace, target: &Path) -> Result<PathBuf, Value> {
    let root = state.get().ok_or_else(|| fail("No workspace selected"))?;
    if workspace::is_inside(&root, target) {
        Ok(root)
    } else {
        Err(fail("非法路径"))
    }
}

#[tauri::command]
async fn workspace_select(app: AppHandle, state: State<'_, Workspace>) -> Result<Value, ()> {
    let picked = app.dialog().file().set_title("选择 WeMD 工作区文件夹").blocking_pick_folder();
    let Some(dir) = picked.and_then(|p| p.into_path().ok()) else {
        return Ok(json!({ "success": false, "canceled": true }));
    };
    *state.0.lock().unwrap() = Some(dir.clone());
    Ok(json!({ "success": true, "path": dir }))
}

#[tauri::command]
fn workspace_set(dir: String, state: State<Workspace>) -> Value {
    let dir = PathBuf::from(dir);
    if !dir.is_dir() {
        return fail("Directory not found");
    }
    *state.0.lock().unwrap() = Some(dir.clone());
    json!({ "success": true, "path": dir })
}

#[tauri::command]
fn file_list(dir: Option<String>, state: State<Workspace>) -> Value {
    let Some(target) = dir.map(PathBuf::from).or_else(|| state.get()) else {
        return fail("No workspace selected");
    };
    if let Err(e) = guard(&state, &target) {
        return e;
    }
    json!({ "success": true, "files": workspace::scan(&target) })
}

#[tauri::command]
fn file_read(file_path: String, state: State<Workspace>) -> Value {
    let path = PathBuf::from(&file_path);
    if let Err(e) = guard(&state, &path) {
        return e;
    }
    match fs::read_to_string(&path) {
        Ok(content) => json!({ "success": true, "content": content, "filePath": file_path }),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => fail("File not found"),
        Err(e) => fail(e),
    }
}

#[derive(Deserialize)]
struct CreatePayload {
    filename: Option<String>,
    content: Option<String>,
}

#[tauri::command]
fn file_create(payload: CreatePayload, state: State<Workspace>) -> Value {
    let Some(root) = state.get() else {
        return fail("No workspace");
    };
    let name = payload.filename.unwrap_or_else(|| "未命名文章.md".into());
    let target = root.join(name);
    if !workspace::is_inside(&root, &target) {
        return fail("非法路径");
    }
    let target = workspace::unique_path(&target);
    let written = target
        .parent()
        .map_or(Ok(()), fs::create_dir_all)
        .and_then(|_| fs::write(&target, payload.content.unwrap_or_default()));
    match written {
        Ok(()) => json!({
            "success": true,
            "filePath": target,
            "filename": target.file_name().map(|n| n.to_string_lossy()),
        }),
        Err(e) => fail(e),
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SavePayload {
    file_path: String,
    content: String,
}

#[tauri::command]
fn file_save(payload: SavePayload, state: State<Workspace>) -> Value {
    let path = PathBuf::from(&payload.file_path);
    if let Err(e) = guard(&state, &path) {
        return e;
    }
    // 内容未变时不写盘，避免触发外部监听
    if fs::read_to_string(&path).is_ok_and(|old| old == payload.content) {
        return json!({ "success": true, "filePath": payload.file_path });
    }
    match fs::write(&path, &payload.content) {
        Ok(()) => json!({ "success": true, "filePath": payload.file_path }),
        Err(e) => fail(e),
    }
}

#[tauri::command]
fn theme_read(state: State<Workspace>) -> Value {
    let Some(root) = state.get() else {
        return fail("No workspace selected");
    };
    match fs::read_to_string(workspace::theme_file(&root)) {
        Ok(content) => json!({ "success": true, "content": content }),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => json!({ "success": true, "content": null }),
        Err(e) => fail(e),
    }
}

#[tauri::command]
fn theme_write(content: String, state: State<Workspace>) -> Value {
    let Some(root) = state.get() else {
        return fail("No workspace selected");
    };
    let file = workspace::theme_file(&root);
    let written = file.parent().map_or(Ok(()), fs::create_dir_all).and_then(|_| fs::write(&file, content));
    match written {
        Ok(()) => json!({ "success": true }),
        Err(e) => fail(e),
    }
}

#[tauri::command]
fn clipboard_write_html(html: String, text: String, app: AppHandle) -> Value {
    if html.trim().is_empty() {
        return fail("HTML 不能为空");
    }
    match app.clipboard().write_html(html, Some(text)) {
        Ok(()) => json!({ "success": true }),
        Err(e) => fail(e),
    }
}

#[tauri::command]
fn clipboard_write_text(text: String, app: AppHandle) -> Value {
    if text.trim().is_empty() {
        return fail("文本不能为空");
    }
    match app.clipboard().write_text(text) {
        Ok(()) => json!({ "success": true }),
        Err(e) => fail(e),
    }
}

/// 只放行 http/https，与 Electron 版一致
#[tauri::command]
fn open_external(url: String, app: AppHandle) {
    if url.starts_with("http://") || url.starts_with("https://") {
        let _ = app.opener().open_url(url, None::<&str>);
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(Workspace::default())
        .invoke_handler(tauri::generate_handler![
            workspace_select,
            workspace_set,
            file_list,
            file_read,
            file_create,
            file_save,
            theme_read,
            theme_write,
            clipboard_write_html,
            clipboard_write_text,
            open_external,
        ])
        .setup(|app| {
            let builder = WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
                .title("WeMD")
                .inner_size(1280.0, 800.0)
                .min_inner_size(1100.0, 640.0)
                .maximized(true)
                // 侧边栏拖放走 HTML5 drop，关闭原生拖放接管
                .disable_drag_drop_handler()
                .initialization_script(include_str!("bridge.js"));
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
