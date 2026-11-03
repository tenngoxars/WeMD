// Electron 版设置迁移：读取 Electron userData 下的 wemd-migration.json（由 apps/electron/src/migration/exportSettings.ts 导出），
// 启动时在 Rust 侧读取，生成初始化脚本在页面脚本之前同步写入 localStorage，再调用 migration_delete 删除。
// 任何日志都不得输出文件内容（含 API Key）
use serde::Deserialize;
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

// 导入标记：不在白名单内，导出端不会碰它；初始化脚本每次页面加载都会执行，靠它保证只导入一次
const MIGRATION_MARK: &str = "wemd-electron-migrated-at";

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

/// Electron 写入中断留下的临时文件，命名需与 exportSettings.ts 的 TEMP_FILE 一致
fn is_temp_file(name: &str) -> bool {
    name.strip_prefix("wemd-migration.json.")
        .and_then(|rest| rest.strip_suffix(".tmp"))
        .is_some_and(|pid| !pid.is_empty() && pid.bytes().all(|b| b.is_ascii_digit()))
}

fn script(entries: &BTreeMap<String, String>) -> String {
    // serde_json 的输出是合法的 JS 字面量，值中的引号、换行等都已转义，不会被当作代码执行
    let entries = serde_json::to_string(entries).expect("字符串表可序列化");
    let mark = serde_json::to_string(MIGRATION_MARK).expect("字符串可序列化");
    format!(
        r#"(() => {{
  try {{
    if (!localStorage.getItem({mark})) {{
      for (const [key, value] of Object.entries({entries})) localStorage.setItem(key, value);
      localStorage.setItem({mark}, new Date().toISOString());
    }}
  }} catch (error) {{
    console.error("[WeMD] 导入 Electron 设置失败", error?.name ?? "");
  }}
  window.__TAURI__.core.invoke("migration_delete").catch(() => {{}});
}})();"#
    )
}

/// 有可导入的设置时返回初始化脚本（在页面脚本之前同步写入 localStorage）
pub fn init_script(app: &AppHandle) -> Option<String> {
    read(&migration_file(&app.path().config_dir().ok()?)).map(|entries| script(&entries))
}

fn delete(config_dir: &Path) {
    let file = migration_file(config_dir);
    let _ = std::fs::remove_file(&file);
    let Ok(dir) = std::fs::read_dir(file.parent().expect("迁移文件有上级目录")) else {
        return;
    };
    for entry in dir.flatten() {
        if entry.file_name().to_str().is_some_and(is_temp_file) {
            let _ = std::fs::remove_file(entry.path());
        }
    }
}

#[tauri::command]
pub fn migration_delete(app: AppHandle) {
    if let Ok(dir) = app.path().config_dir() {
        delete(&dir);
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

    #[test]
    fn script_embeds_values_as_literals() {
        let tricky = "a\"b'c</script>\n\\d\u{2028}e\u{2029}`${x}`";
        let entries = BTreeMap::from([("wemd-ai-config".to_string(), tricky.to_string())]);
        let js = script(&entries);
        let start = js.find("Object.entries(").unwrap() + "Object.entries(".len();
        let end = js[start..].find(")) localStorage").unwrap() + start;
        let back: BTreeMap<String, String> = serde_json::from_str(&js[start..end]).unwrap();
        assert_eq!(back, entries);
    }

    #[test]
    fn delete_removes_file_and_strict_temp_files() {
        let dir = std::env::temp_dir().join(format!("wemd-mig-del-{}", std::process::id()));
        let file = migration_file(&dir);
        let parent = file.parent().unwrap();
        std::fs::create_dir_all(parent).unwrap();
        for name in ["wemd-migration.json", "wemd-migration.json.42.tmp", "wemd-migration.json.x.tmp", "wemd-migration.json..tmp"] {
            std::fs::write(parent.join(name), "").unwrap();
        }
        delete(&dir);
        let mut left: Vec<_> = std::fs::read_dir(parent).unwrap().map(|e| e.unwrap().file_name()).collect();
        left.sort();
        assert_eq!(left, ["wemd-migration.json..tmp", "wemd-migration.json.x.tmp"]);
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
