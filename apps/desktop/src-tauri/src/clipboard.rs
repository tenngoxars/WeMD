// 剪贴板命令：写入对齐 Electron 的 ipc/clipboardHandlers；读取供 Linux 上 bridge.js 拦截粘贴后使用
use serde_json::{json, Value};
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;
use tauri_plugin_clipboard_manager::ClipboardExt;

fn result(written: Result<(), impl ToString>) -> Value {
    match written {
        Ok(()) => json!({ "success": true }),
        Err(e) => json!({ "success": false, "error": e.to_string() }),
    }
}

#[tauri::command]
pub fn clipboard_write_html(html: String, text: String, app: AppHandle) -> Value {
    if html.trim().is_empty() {
        return json!({ "success": false, "error": "HTML 不能为空" });
    }
    result(app.clipboard().write_html(html, Some(text)))
}

#[tauri::command]
pub fn clipboard_write_text(text: String, app: AppHandle) -> Value {
    if text.trim().is_empty() {
        return json!({ "success": false, "error": "文本不能为空" });
    }
    result(app.clipboard().write_text(text))
}

/// 剪贴板里的图片编码成 PNG 返回，没有图片时返回空内容。
/// Linux 的 WebKitGTK 自己处理图片粘贴会崩溃（≥2.52）或拿不到图片（<2.52），粘贴由 bridge.js 拦下后走这里。
#[tauri::command]
pub async fn clipboard_read_image(app: AppHandle) -> tauri::ipc::Response {
    let Ok(image) = app.clipboard().read_image() else {
        return tauri::ipc::Response::new(Vec::new());
    };
    let mut png_bytes = Vec::new();
    let mut encoder = png::Encoder::new(&mut png_bytes, image.width(), image.height());
    encoder.set_color(png::ColorType::Rgba);
    encoder.set_depth(png::BitDepth::Eight);
    let encoded = encoder
        .write_header()
        .and_then(|mut writer| writer.write_image_data(image.rgba()));
    if encoded.is_err() {
        png_bytes.clear();
    }
    tauri::ipc::Response::new(png_bytes)
}

#[tauri::command]
pub async fn clipboard_read_text(app: AppHandle) -> Option<String> {
    app.clipboard().read_text().ok()
}

const IMAGE_EXTENSIONS: [&str; 6] = ["png", "jpg", "jpeg", "gif", "webp", "bmp"];
const MAX_PASTE_FILE_BYTES: u64 = 50 * 1024 * 1024;

/// 文件管理器复制图片时剪贴板里只有文件路径，这里列出其中的图片文件
fn clipboard_image_paths() -> Vec<PathBuf> {
    let files = arboard::Clipboard::new().and_then(|mut c| c.get().file_list());
    files
        .unwrap_or_default()
        .into_iter()
        .filter(|p| {
            p.extension()
                .and_then(|e| e.to_str())
                .is_some_and(|e| IMAGE_EXTENSIONS.contains(&e.to_ascii_lowercase().as_str()))
        })
        .collect()
}

#[tauri::command]
pub async fn clipboard_image_files() -> Vec<String> {
    clipboard_image_paths()
        .iter()
        .filter_map(|p| p.file_name().map(|n| n.to_string_lossy().into_owned()))
        .collect()
}

/// 按序号读取剪贴板里的图片文件原始字节。只接受序号、不接受路径，网页不能借此读取任意文件
#[tauri::command]
pub async fn clipboard_read_image_file(index: usize) -> Result<tauri::ipc::Response, String> {
    let path = clipboard_image_paths()
        .into_iter()
        .nth(index)
        .ok_or("剪贴板内容已变化")?;
    let size = fs::metadata(&path).map_err(|e| e.to_string())?.len();
    if size > MAX_PASTE_FILE_BYTES {
        return Err("图片超过 50 MB".into());
    }
    fs::read(&path)
        .map(tauri::ipc::Response::new)
        .map_err(|e| e.to_string())
}
