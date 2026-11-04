// 工作区文件监听，过滤与去抖对齐 apps/electron/src/watch（workspaceWatcher、workspaceWatcherUtils）
use notify::event::{CreateKind, ModifyKind, RemoveKind};
use notify::{Event, EventKind, RecursiveMode, Watcher as _};
use std::path::{Component, Path, PathBuf};
use std::sync::mpsc::{self, RecvTimeoutError};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

pub type Watcher = notify::RecommendedWatcher;

const DEBOUNCE: Duration = Duration::from_millis(300);

/// 变动是否影响文件列表：路径中有隐藏段的忽略；文件夹、.md 文件、已删除且无扩展名（多半是文件夹）的才刷新。
/// `relative` 是相对工作区的路径，工作区本身位于隐藏目录下（如 ~/.cache）也不受影响
fn should_refresh(relative: &Path, exists: bool, is_dir: bool) -> bool {
    if !visible(relative) {
        return false;
    }
    if is_dir {
        return true;
    }
    match relative.extension() {
        Some(ext) => ext.eq_ignore_ascii_case("md"),
        None => !exists,
    }
}

fn visible(relative: &Path) -> bool {
    !relative.as_os_str().is_empty()
        && !relative
            .components()
            .any(|c| matches!(c, Component::Normal(s) if s.to_string_lossy().starts_with('.')))
}

fn event_needs_refresh(roots: &[PathBuf], event: &Event) -> bool {
    // 读文件（打开、关闭）不改变列表；扫描文件列表本身就会产生这类事件，不忽略会循环刷新
    if matches!(event.kind, EventKind::Access(_)) {
        return false;
    }
    let folder_event = matches!(
        event.kind,
        EventKind::Create(CreateKind::Folder) | EventKind::Remove(RemoveKind::Folder)
    );
    // 重命名的旧路径已不存在，带点的目录（如 notes.v1）无法按扩展名判断，只要不是隐藏路径就刷新
    let rename_event = matches!(event.kind, EventKind::Modify(ModifyKind::Name(_)));
    event.paths.iter().any(|path| {
        // macOS 的 FSEvents 报告解析过符号链接的路径，所以根目录另备一份规范化后的
        let Some(relative) = roots.iter().find_map(|root| path.strip_prefix(root).ok()) else {
            return false;
        };
        if rename_event {
            return visible(relative);
        }
        should_refresh(relative, path.exists(), folder_event || path.is_dir())
    })
}

/// 开始监听；返回的 Watcher 被丢弃即停止监听，去抖线程随之退出，未发出的刷新一并取消
pub fn watch(app: AppHandle, root: PathBuf) -> notify::Result<Watcher> {
    let (tx, rx) = mpsc::channel::<()>();
    let roots: Vec<PathBuf> = [Some(root.clone()), root.canonicalize().ok()]
        .into_iter()
        .flatten()
        .collect();
    let mut watcher = notify::recommended_watcher(move |result: notify::Result<Event>| {
        if result.is_ok_and(|event| event_needs_refresh(&roots, &event)) {
            let _ = tx.send(());
        }
    })?;
    // ponytail: 递归监听会给隐藏目录（如 .git）也加 inotify watch，超大工作区可能触到系统上限；遇到再改成逐目录监听并跳过隐藏项
    watcher.watch(&root, RecursiveMode::Recursive)?;
    std::thread::spawn(move || {
        while rx.recv().is_ok() {
            loop {
                match rx.recv_timeout(DEBOUNCE) {
                    Ok(()) => continue,
                    Err(RecvTimeoutError::Timeout) => break,
                    Err(RecvTimeoutError::Disconnected) => return,
                }
            }
            let _ = app.emit("file:refresh", ());
        }
    });
    Ok(watcher)
}

#[cfg(test)]
mod tests {
    use super::*;
    use notify::event::{AccessKind, RenameMode};

    #[test]
    fn filters_like_electron() {
        let rel = Path::new;
        assert!(should_refresh(rel("a.md"), true, false));
        assert!(should_refresh(rel("sub/A.MD"), true, false));
        assert!(should_refresh(rel("sub"), true, true));
        // 删除的无扩展名路径视为文件夹
        assert!(should_refresh(rel("gone"), false, false));
        assert!(!should_refresh(rel("notes.txt"), true, false));
        assert!(!should_refresh(rel(".wemd/themes.json"), true, false));
        assert!(!should_refresh(rel("sub/.git/x.md"), true, false));
        assert!(!should_refresh(rel(""), true, true));
    }

    #[test]
    fn workspace_under_hidden_dir_still_refreshes() {
        let roots = [PathBuf::from("/home/u/.cache/ws")];
        let event = |kind, path: &str| Event::new(kind).add_path(PathBuf::from(path));
        let modify = EventKind::Modify(ModifyKind::Any);
        assert!(event_needs_refresh(
            &roots,
            &event(modify, "/home/u/.cache/ws/a.md")
        ));
        assert!(!event_needs_refresh(
            &roots,
            &event(modify, "/home/u/.cache/other/a.md")
        ));
        assert!(!event_needs_refresh(
            &roots,
            &event(EventKind::Access(AccessKind::Any), "/home/u/.cache/ws/a.md")
        ));
    }

    #[test]
    fn rename_of_dotted_dir_refreshes() {
        let roots = [PathBuf::from("/ws")];
        let rename = |mode, paths: &[&str]| {
            paths.iter().fold(
                Event::new(EventKind::Modify(ModifyKind::Name(mode))),
                |e, p| e.add_path(PathBuf::from(p)),
            )
        };
        // 移出工作区：只有不存在的旧路径
        assert!(event_needs_refresh(
            &roots,
            &rename(RenameMode::From, &["/ws/notes.v1"])
        ));
        // 改成隐藏名：旧路径可见即刷新
        assert!(event_needs_refresh(
            &roots,
            &rename(RenameMode::Both, &["/ws/notes.v1", "/ws/.notes.v1"])
        ));
        assert!(!event_needs_refresh(
            &roots,
            &rename(RenameMode::Both, &["/ws/.a", "/ws/.b"])
        ));
        assert!(!event_needs_refresh(
            &roots,
            &rename(RenameMode::To, &["/other/x"])
        ));
    }
}
