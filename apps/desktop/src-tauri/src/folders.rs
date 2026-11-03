// 文件夹命令（含把文件移入文件夹），行为对齐 Electron 的 ipc/folderHandlers.ts
use crate::files::{base_name, fail, ok, same_path, trash_or, with_root, Workspace};
use crate::workspace;
use serde::Deserialize;
use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::State;

fn create_folder(root: &Path, name: &str) -> Value {
    let name = name.trim();
    if name.is_empty() {
        return fail("文件夹名称不能为空");
    }
    let target = root.join(name);
    if !workspace::is_inside(root, &target) {
        return fail("非法路径");
    }
    if target.exists() {
        return fail("文件夹已存在");
    }
    match fs::create_dir_all(&target) {
        Ok(()) => json!({ "success": true, "path": target, "name": target.file_name().map(|n| n.to_string_lossy()) }),
        Err(e) => fail(e),
    }
}

#[tauri::command]
pub fn folder_create(folder_path: String, state: State<Workspace>) -> Value {
    with_root(&state, |root| create_folder(root, &folder_path))
}

/// 检查是工作区内已存在的文件夹
fn existing_folder(root: &Path, folder: &Path) -> Result<(), Value> {
    if !workspace::is_inside(root, folder) {
        return Err(fail("非法路径"));
    }
    match fs::metadata(folder) {
        Err(_) => Err(fail("文件夹不存在")),
        Ok(meta) if !meta.is_dir() => Err(fail("不是文件夹")),
        Ok(_) => Ok(()),
    }
}

fn rename_folder(root: &Path, folder: &Path, new_name: &str) -> Value {
    if folder.as_os_str().is_empty() || new_name.is_empty() {
        return fail("Invalid arguments");
    }
    if let Err(e) = existing_folder(root, folder) {
        return e;
    }
    let Some(base) = base_name(new_name.trim()) else {
        return fail("文件夹名称不能为空");
    };
    let target = folder.parent().unwrap_or(Path::new("")).join(base);
    if !workspace::is_inside(root, &target) {
        return fail("非法路径");
    }
    if same_path(folder, &target) {
        return json!({ "success": true, "newPath": target });
    }
    if target.exists() {
        return fail("文件夹已存在");
    }
    match fs::rename(folder, &target) {
        Ok(()) => json!({ "success": true, "newPath": target }),
        Err(e) => fail(e),
    }
}

#[derive(Deserialize, Default)]
#[serde(default, rename_all = "camelCase")]
pub struct FolderRenamePayload {
    folder_path: String,
    new_name: String,
}

#[tauri::command]
pub fn folder_rename(payload: FolderRenamePayload, state: State<Workspace>) -> Value {
    with_root(&state, |root| rename_folder(root, Path::new(&payload.folder_path), &payload.new_name))
}

/// 目标文件夹为空时表示工作区根目录
fn target_dir(root: &Path, target_folder: &str) -> PathBuf {
    if target_folder.is_empty() { root.to_path_buf() } else { PathBuf::from(target_folder) }
}

fn move_folder(root: &Path, folder: &Path, target_folder: &str) -> Value {
    if folder.as_os_str().is_empty() {
        return fail("Path required");
    }
    if let Err(e) = existing_folder(root, folder) {
        return e;
    }
    let target = target_dir(root, target_folder);
    if !workspace::is_inside(root, &target) {
        return fail("非法路径");
    }
    if !target.is_dir() {
        return fail("目标文件夹不存在");
    }
    let new_path = target.join(folder.file_name().unwrap_or_default());
    if same_path(folder, &new_path) {
        return json!({ "success": true, "newPath": new_path });
    }
    if workspace::normalize(&new_path).starts_with(workspace::normalize(folder)) {
        return fail("不能移动到子文件夹");
    }
    if new_path.exists() {
        return fail("目标位置已存在同名文件夹");
    }
    match fs::rename(folder, &new_path) {
        Ok(()) => json!({ "success": true, "newPath": new_path }),
        Err(e) => fail(e),
    }
}

#[derive(Deserialize, Default)]
#[serde(default, rename_all = "camelCase")]
pub struct MoveFolderPayload {
    folder_path: String,
    target_folder: Option<String>,
}

#[tauri::command]
pub fn folder_move_folder(payload: MoveFolderPayload, state: State<Workspace>) -> Value {
    let target = payload.target_folder.unwrap_or_default();
    with_root(&state, |root| move_folder(root, Path::new(&payload.folder_path), &target))
}

fn move_file(root: &Path, file: &Path, target_folder: &str) -> Value {
    if file.as_os_str().is_empty() {
        return fail("File path required");
    }
    let target = target_dir(root, target_folder);
    if !workspace::is_inside(root, file) || !workspace::is_inside(root, &target) {
        return fail("非法路径");
    }
    let new_path = target.join(file.file_name().unwrap_or_default());
    if same_path(file, &new_path) {
        return json!({ "success": true, "newPath": new_path });
    }
    if new_path.exists() {
        return fail("目标位置已存在同名文件");
    }
    match fs::rename(file, &new_path) {
        Ok(()) => json!({ "success": true, "newPath": new_path }),
        Err(e) => fail(e),
    }
}

#[derive(Deserialize, Default)]
#[serde(default, rename_all = "camelCase")]
pub struct MoveFilePayload {
    file_path: String,
    target_folder: Option<String>,
}

#[tauri::command]
pub fn folder_move(payload: MoveFilePayload, state: State<Workspace>) -> Value {
    let target = payload.target_folder.unwrap_or_default();
    with_root(&state, |root| move_file(root, Path::new(&payload.file_path), &target))
}

/// 列出文件夹里文件列表看不到的内容（隐藏项与非 Markdown 文件），供前端删除前确认
fn inspect_folder(root: &Path, folder: &Path) -> Value {
    if folder.as_os_str().is_empty() {
        return fail("Path required");
    }
    if let Err(e) = existing_folder(root, folder) {
        return e;
    }
    match fs::read_dir(folder) {
        Ok(entries) => {
            let extra: Vec<String> = entries
                .flatten()
                .filter_map(|entry| {
                    let name = entry.file_name().to_string_lossy().into_owned();
                    let is_file = entry.file_type().is_ok_and(|t| t.is_file());
                    (name.starts_with('.') || (is_file && !name.ends_with(".md"))).then_some(name)
                })
                .collect();
            json!({ "success": true, "entries": extra })
        }
        Err(e) => fail(e),
    }
}

#[tauri::command]
pub fn folder_inspect(folder_path: String, state: State<Workspace>) -> Value {
    with_root(&state, |root| inspect_folder(root, Path::new(&folder_path)))
}

/// 非递归只删空文件夹；递归删除移到回收站
fn delete_folder(root: &Path, folder: &Path, recursive: bool) -> Value {
    if folder.as_os_str().is_empty() {
        return fail("Path required");
    }
    if !workspace::is_inside(root, folder) {
        return fail("非法路径");
    }
    let Ok(meta) = fs::metadata(folder) else {
        return ok();
    };
    if !meta.is_dir() {
        return fail("不是文件夹");
    }
    if recursive {
        return trash_or(folder, |p| fs::remove_dir_all(p));
    }
    match fs::read_dir(folder).map(|mut entries| entries.next().is_some()) {
        Ok(true) => fail("文件夹不为空，请先移出或删除其中的文件"),
        Ok(false) => fs::remove_dir(folder).map_or_else(fail, |_| ok()),
        Err(e) => fail(e),
    }
}

#[derive(Deserialize, Default)]
#[serde(default, rename_all = "camelCase")]
pub struct DeleteFolderPayload {
    folder_path: String,
    recursive: Option<bool>,
}

#[tauri::command]
pub async fn folder_delete(payload: DeleteFolderPayload, state: State<'_, Workspace>) -> Result<Value, ()> {
    let recursive = payload.recursive == Some(true);
    Ok(with_root(&state, |root| delete_folder(root, Path::new(&payload.folder_path), recursive)))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::files::tests::{error, temp_root};

    #[test]
    fn folder_moves_stay_inside_and_never_nest_into_self() {
        let root = temp_root("move");
        let sub = root.join("sub");
        fs::create_dir_all(sub.join("child")).unwrap();

        assert_eq!(error(&move_folder(&root, &sub, sub.join("child").to_str().unwrap())), "不能移动到子文件夹");
        assert_eq!(error(&move_folder(&root, &sub, "/tmp")), "非法路径");
        assert_eq!(error(&rename_folder(&root, &sub, "..")), "文件夹名称不能为空");
        assert_eq!(error(&create_folder(&root, "../outside")), "非法路径");

        fs::write(root.join("a.md"), "").unwrap();
        let moved = move_file(&root, &root.join("a.md"), sub.to_str().unwrap());
        assert_eq!(moved["newPath"], json!(sub.join("a.md")));
        fs::write(root.join("a.md"), "").unwrap();
        assert_eq!(error(&move_file(&root, &root.join("a.md"), sub.to_str().unwrap())), "目标位置已存在同名文件");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn non_recursive_delete_refuses_non_empty_folder() {
        let root = temp_root("delete");
        let sub = root.join("sub");
        fs::write(sub.join(".hidden"), "").unwrap();
        fs::write(sub.join("note.txt"), "").unwrap();
        fs::write(sub.join("a.md"), "").unwrap();

        let mut entries: Vec<String> = serde_json::from_value(inspect_folder(&root, &sub)["entries"].clone()).unwrap();
        entries.sort();
        assert_eq!(entries, [".hidden", "note.txt"]);
        assert_eq!(error(&delete_folder(&root, &sub, false)), "文件夹不为空，请先移出或删除其中的文件");
        assert_eq!(error(&delete_folder(&root, Path::new("/tmp"), true)), "非法路径");
        fs::remove_dir_all(root).unwrap();
    }
}
