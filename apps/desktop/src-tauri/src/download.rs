// 前端用 <a download> 导出长图与主题。WebView 默认直接存到进程工作目录，这里改成：
// 先下载到临时目录，完成后弹出保存对话框（默认文件名用前端给的名字），取消则删掉临时文件。
// 下载事件在主线程回调，对话框必须用非阻塞的 save_file，阻塞调用会卡死主线程。
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use tauri::webview::DownloadEvent;
use tauri::{Manager, Runtime, Webview};
use tauri_plugin_dialog::DialogExt;

/// 下载地址 → 临时文件。macOS 完成回调不给文件路径，只能按地址对应
static PENDING: Mutex<Option<HashMap<String, PathBuf>>> = Mutex::new(None);
static NEXT: AtomicU64 = AtomicU64::new(0);

fn temp_dir() -> PathBuf {
    std::env::temp_dir().join("wemd-downloads").join(format!(
        "{}-{}",
        std::process::id(),
        NEXT.fetch_add(1, Ordering::Relaxed)
    ))
}

fn discard(temp: &Path) {
    if let Some(dir) = temp.parent() {
        let _ = fs::remove_dir_all(dir);
    }
}

/// 跨文件系统（/tmp 常是 tmpfs）时 rename 会失败，退回复制
fn move_to(temp: &Path, target: &Path) -> std::io::Result<()> {
    fs::rename(temp, target).or_else(|_| fs::copy(temp, target).map(|_| ()))
}

pub fn handle<R: Runtime>(webview: Webview<R>, event: DownloadEvent<'_>) -> bool {
    match event {
        DownloadEvent::Requested { url, destination } => {
            let name = destination
                .file_name()
                .map(|n| n.to_os_string())
                .unwrap_or_else(|| "download".into());
            let temp = temp_dir().join(name);
            if let Err(e) = fs::create_dir_all(temp.parent().unwrap()) {
                eprintln!("[WeMD] 无法创建下载临时目录：{e}");
                return false;
            }
            *destination = temp.clone();
            PENDING
                .lock()
                .unwrap()
                .get_or_insert_default()
                .insert(url.to_string(), temp);
            true
        }
        DownloadEvent::Finished { url, success, .. } => {
            let Some(temp) = PENDING
                .lock()
                .unwrap()
                .get_or_insert_default()
                .remove(url.as_str())
            else {
                return true;
            };
            if !success {
                discard(&temp);
                return true;
            }
            let app = webview.app_handle();
            let mut dialog = app.dialog().file();
            if let Some(window) = app.get_webview_window(webview.label()) {
                dialog = dialog.set_parent(&window);
            }
            // 与 Electron 一样默认放在「下载」目录；WebView 给的默认位置在取不到下载目录时是进程工作目录
            if let Ok(dir) = app.path().download_dir().or_else(|_| app.path().home_dir()) {
                dialog = dialog.set_directory(dir);
            }
            if let Some(name) = temp.file_name() {
                dialog = dialog.set_file_name(name.to_string_lossy());
            }
            dialog.save_file(move |picked| {
                if let Some(target) = picked.and_then(|p| p.into_path().ok()) {
                    if let Err(e) = move_to(&temp, &target) {
                        eprintln!("[WeMD] 保存下载文件失败：{e}");
                    }
                }
                discard(&temp);
            });
            true
        }
        _ => true,
    }
}
