// Electron 版设置迁移：读取 Electron userData 下的 wemd-migration.json（由 apps/electron/src/migration/exportSettings.ts 导出），
// 由 bridge.js 写入 localStorage 后再调用 migration_delete 删除。任何日志都不得输出文件内容（含 API Key）
use serde::Deserialize;
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

// 白名单需与 apps/electron/src/migration/exportSettings.ts 的 MIGRATION_KEYS 保持同步
const MIGRATION_KEYS: &[&str] = &[
    "wemd-ai-config",
    "imageHostConfigs",
    "imageHostConfig",
    "wemd-workspace-path",
    "wemd-last-file-path",
    "wemd-selected-theme",
    "wemd-custom-themes",
    "wemd-format-options",
    "wemd-link-to-footnote",
    "wemd-table-wrap",
    "wemd-ui-theme",
    "wemd-header-autohide",
    "wemd-show-history",
    "wemd-editor-pane-width",
    "wemd-editor-pane-ratio",
    "wemd-file-sort-mode",
    "wemd-folder-collapsed",
];
const MIGRATION_VERSION: u32 = 1;
const MAX_SIZE: u64 = 5 * 1024 * 1024;

#[derive(Deserialize)]
struct Payload {
    version: u32,
    entries: BTreeMap<String, serde_json::Value>,
}

/// Electron 的 appData 与 Tauri 的 config_dir 一致（XDG_CONFIG_HOME / Application Support / Roaming AppData），
/// 其下是 app.setName("WeMD") 决定的目录
fn migration_file(config_dir: &Path) -> PathBuf {
    config_dir.join("WeMD").join("wemd-migration.json")
}

/// 格式或版本不对返回 None；只保留白名单内的字符串值
fn parse(bytes: &[u8]) -> Option<BTreeMap<String, String>> {
    let payload: Payload = serde_json::from_slice(bytes).ok()?;
    if payload.version != MIGRATION_VERSION {
        return None;
    }
    Some(
        payload
            .entries
            .into_iter()
            .filter(|(key, _)| MIGRATION_KEYS.contains(&key.as_str()))
            .filter_map(|(key, value)| match value {
                serde_json::Value::String(s) => Some((key, s)),
                _ => None,
            })
            .collect(),
    )
}

/// 超限或无法识别的文件直接删除：内容可能含 API Key，不应长期留在磁盘
fn read(path: &Path) -> Option<BTreeMap<String, String>> {
    let size = std::fs::metadata(path).ok()?.len();
    let entries = if size > MAX_SIZE {
        eprintln!("[WeMD] 迁移文件超过 5 MB，已删除");
        None
    } else {
        let entries = parse(&std::fs::read(path).ok()?);
        if entries.is_none() {
            eprintln!("[WeMD] 迁移文件格式或版本无法识别，已删除");
        }
        entries
    };
    if entries.is_none() {
        let _ = std::fs::remove_file(path);
    }
    entries
}

/// 没有文件或无法识别时返回 null
#[tauri::command]
pub fn migration_read(app: AppHandle) -> Option<BTreeMap<String, String>> {
    read(&migration_file(&app.path().config_dir().ok()?))
}

#[tauri::command]
pub fn migration_delete(app: AppHandle) {
    if let Ok(dir) = app.path().config_dir() {
        let _ = std::fs::remove_file(migration_file(&dir));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_filters_whitelist_and_version() {
        let entries = parse(
            br#"{"version":1,"exportedAt":"x","entries":{"wemd-ai-config":"k","wemd-skipped-version":"1","wemd-table-wrap":1}}"#,
        )
        .unwrap();
        assert_eq!(entries.into_iter().collect::<Vec<_>>(), vec![("wemd-ai-config".into(), "k".into())]);
        assert!(parse(br#"{"version":2,"entries":{}}"#).is_none());
        assert!(parse(b"garbage").is_none());
    }

    #[test]
    fn read_handles_missing_and_deletes_unusable() {
        let dir = std::env::temp_dir().join(format!("wemd-mig-{}", std::process::id()));
        let file = migration_file(&dir);
        assert!(read(&file).is_none());
        std::fs::create_dir_all(file.parent().unwrap()).unwrap();
        std::fs::write(&file, vec![b' '; MAX_SIZE as usize + 1]).unwrap();
        assert!(read(&file).is_none());
        assert!(!file.exists());
        std::fs::write(&file, br#"{"version":2,"entries":{}}"#).unwrap();
        assert!(read(&file).is_none());
        assert!(!file.exists());
        std::fs::write(&file, br#"{"version":1,"entries":{"wemd-ui-theme":"dark"}}"#).unwrap();
        assert_eq!(read(&file).unwrap()["wemd-ui-theme"], "dark");
        assert!(file.exists());
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
