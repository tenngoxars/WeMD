// 工作区、文件、主题命令与共用的结果、回收站工具，行为对齐 Electron 的 ipc/workspaceHandlers、fileHandlers、themeHandlers
use crate::{watcher, workspace};
use serde::Deserialize;
use serde_json::{json, Value};
use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;

/// 当前工作区与它的文件监听；切换工作区时旧监听随之释放
#[derive(Default)]
pub struct Workspace {
    dir: Mutex<Option<PathBuf>>,
    watcher: Mutex<Option<watcher::Watcher>>,
}

impl Workspace {
    fn get(&self) -> Option<PathBuf> {
        self.dir.lock().unwrap().clone()
    }

    fn set(&self, app: &AppHandle, dir: PathBuf) {
        *self.dir.lock().unwrap() = Some(dir.clone());
        *self.watcher.lock().unwrap() = watcher::watch(app.clone(), dir)
            .inspect_err(|e| eprintln!("[WeMD] 监听工作区失败：{e}"))
            .ok();
    }
}

pub(crate) fn fail(error: impl ToString) -> Value {
    json!({ "success": false, "error": error.to_string() })
}

pub(crate) fn ok() -> Value {
    json!({ "success": true })
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

pub(crate) fn with_root(state: &Workspace, run: impl FnOnce(&Path) -> Value) -> Value {
    match state.get() {
        Some(root) => run(&root),
        None => fail("No workspace"),
    }
}

pub(crate) fn same_path(a: &Path, b: &Path) -> bool {
    workspace::normalize(a) == workspace::normalize(b)
}

/// 对应 Node 的 path.basename：取最后一段，空串、「.」「..」视为空
pub(crate) fn base_name(name: &str) -> Option<&std::ffi::OsStr> {
    Path::new(name).file_name()
}

#[tauri::command]
pub async fn workspace_select(app: AppHandle, state: State<'_, Workspace>) -> Result<Value, ()> {
    let picked = app.dialog().file().set_title("选择 WeMD 工作区文件夹").blocking_pick_folder();
    let Some(dir) = picked.and_then(|p| p.into_path().ok()) else {
        return Ok(json!({ "success": false, "canceled": true }));
    };
    state.set(&app, dir.clone());
    Ok(json!({ "success": true, "path": dir }))
}

#[tauri::command]
pub fn workspace_set(dir: String, app: AppHandle, state: State<Workspace>) -> Value {
    let dir = PathBuf::from(dir);
    if !dir.is_dir() {
        return fail("Directory not found");
    }
    state.set(&app, dir.clone());
    json!({ "success": true, "path": dir })
}

#[tauri::command]
pub fn file_list(dir: Option<String>, state: State<Workspace>) -> Value {
    let Some(target) = dir.map(PathBuf::from).or_else(|| state.get()) else {
        return fail("No workspace selected");
    };
    if let Err(e) = guard(&state, &target) {
        return e;
    }
    json!({ "success": true, "files": workspace::scan(&target) })
}

#[tauri::command]
pub fn file_read(file_path: String, state: State<Workspace>) -> Value {
    let path = PathBuf::from(&file_path);
    if let Err(e) = guard(&state, &path) {
        return e;
    }
    match fs::read_to_string(&path) {
        Ok(content) => json!({ "success": true, "content": content, "filePath": file_path }),
        Err(e) if e.kind() == ErrorKind::NotFound => fail("File not found"),
        Err(e) => fail(e),
    }
}

#[derive(Deserialize)]
pub struct CreatePayload {
    filename: Option<String>,
    content: Option<String>,
}

#[tauri::command]
pub fn file_create(payload: CreatePayload, state: State<Workspace>) -> Value {
    with_root(&state, |root| {
        let target = root.join(payload.filename.unwrap_or_else(|| "未命名文章.md".into()));
        if !workspace::is_inside(root, &target) {
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
    })
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavePayload {
    file_path: String,
    content: String,
}

#[tauri::command]
pub fn file_save(payload: SavePayload, state: State<Workspace>) -> Value {
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

/// 改名只改文件名：补全 .md，新名字里的目录部分被丢弃；仅大小写不同视为同一个文件
fn rename_file(root: &Path, old: &Path, new_name: &str) -> Value {
    if old.as_os_str().is_empty() || new_name.is_empty() {
        return fail("Invalid arguments");
    }
    if !workspace::is_inside(root, old) {
        return fail("非法路径");
    }
    let dir = old.parent().unwrap_or(Path::new(""));
    let trimmed = new_name.trim();
    let safe_name = if trimmed.ends_with(".md") { trimmed.to_string() } else { format!("{trimmed}.md") };
    let joined = dir.join(&safe_name);
    if same_path(old, &joined) {
        return json!({ "success": true, "filePath": workspace::normalize(&joined) });
    }
    let differs = |target: &Path| {
        workspace::normalize(old).to_string_lossy().to_lowercase()
            != workspace::normalize(target).to_string_lossy().to_lowercase()
    };
    if workspace::normalize(&joined).exists() && differs(&joined) {
        return fail("文件名已存在");
    }
    let target = dir.join(base_name(&safe_name).unwrap_or_default());
    if !workspace::is_inside(root, &target) {
        return fail("非法路径");
    }
    if target.exists() && differs(&target) {
        return fail("文件名已存在");
    }
    match fs::rename(old, &target) {
        Ok(()) => json!({ "success": true, "filePath": target }),
        Err(e) => fail(e),
    }
}

#[derive(Deserialize, Default)]
#[serde(default, rename_all = "camelCase")]
pub struct RenamePayload {
    old_path: String,
    new_name: String,
}

#[tauri::command]
pub fn file_rename(payload: RenamePayload, state: State<Workspace>) -> Value {
    with_root(&state, |root| rename_file(root, Path::new(&payload.old_path), &payload.new_name))
}

/// 移到回收站；回收站不可用时按 Electron 的做法直接删除
pub(crate) fn trash_or(path: &Path, fallback: impl FnOnce(&Path) -> std::io::Result<()>) -> Value {
    match trash::delete(path) {
        Ok(()) => ok(),
        Err(e) => {
            eprintln!("[WeMD] 移到回收站失败，直接删除：{e}");
            fallback(path).map_or_else(fail, |_| ok())
        }
    }
}

fn delete_file(root: &Path, path: &Path) -> Value {
    if path.as_os_str().is_empty() {
        return fail("Path required");
    }
    if !workspace::is_inside(root, path) {
        return fail("非法路径");
    }
    if !path.exists() {
        return ok();
    }
    trash_or(path, |p| if p.exists() { fs::remove_file(p) } else { Ok(()) })
}

#[tauri::command]
pub async fn file_delete(file_path: String, state: State<'_, Workspace>) -> Result<Value, ()> {
    Ok(with_root(&state, |root| delete_file(root, Path::new(&file_path))))
}

#[tauri::command]
pub async fn file_reveal(file_path: String, app: AppHandle, state: State<'_, Workspace>) -> Result<(), ()> {
    let path = PathBuf::from(file_path);
    if !path.as_os_str().is_empty() && guard(&state, &path).is_ok() {
        let _ = app.opener().reveal_item_in_dir(path).inspect_err(|e| eprintln!("[WeMD] 显示文件失败：{e}"));
    }
    Ok(())
}

#[tauri::command]
pub fn theme_read(state: State<Workspace>) -> Value {
    let Some(root) = state.get() else {
        return fail("No workspace selected");
    };
    match fs::read_to_string(workspace::theme_file(&root)) {
        Ok(content) => json!({ "success": true, "content": content }),
        Err(e) if e.kind() == ErrorKind::NotFound => json!({ "success": true, "content": null }),
        Err(e) => fail(e),
    }
}

#[tauri::command]
pub fn theme_write(content: String, state: State<Workspace>) -> Value {
    let Some(root) = state.get() else {
        return fail("No workspace selected");
    };
    let file = workspace::theme_file(&root);
    let written = file.parent().map_or(Ok(()), fs::create_dir_all).and_then(|_| fs::write(&file, content));
    match written {
        Ok(()) => ok(),
        Err(e) => fail(e),
    }
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;

    pub(crate) fn temp_root(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("wemd-files-{}-{name}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(dir.join("sub")).unwrap();
        dir
    }

    pub(crate) fn error(value: &Value) -> &str {
        value["error"].as_str().unwrap_or("")
    }

    #[test]
    fn rename_appends_md_and_checks_conflicts() {
        let root = temp_root("rename");
        let a = root.join("a.md");
        fs::write(&a, "").unwrap();
        fs::write(root.join("b.md"), "").unwrap();

        assert_eq!(error(&rename_file(&root, &a, "b")), "文件名已存在");
        // 新名字里的目录部分被丢弃，不能借改名移出所在目录
        let moved = rename_file(&root, &a, "../../escape");
        assert_eq!(moved["filePath"], json!(root.join("escape.md")));
        // 仅大小写不同不算重名
        let cased = rename_file(&root, &root.join("escape.md"), "ESCAPE.md");
        assert_eq!(cased["success"], json!(true));
        assert!(root.join("ESCAPE.md").exists());
        assert_eq!(error(&rename_file(&root, Path::new("/etc/passwd"), "x")), "非法路径");
        fs::remove_dir_all(root).unwrap();
    }
}
