// 工作区文件逻辑，行为对齐 apps/electron/src/workspace（fileEntries、state、themeStorage、utils/frontmatter）
use serde::Serialize;
use std::fs;
use std::io::Read;
use std::path::{Component, Path, PathBuf};
use std::time::UNIX_EPOCH;

/// 词法规范化（不解析符号链接），对应 Node 的 path.resolve
pub fn normalize(path: &Path) -> PathBuf {
    let absolute = std::path::absolute(path).unwrap_or_else(|_| path.to_path_buf());
    let mut out = PathBuf::new();
    for component in absolute.components() {
        match component {
            Component::ParentDir => {
                out.pop();
            }
            Component::CurDir => {}
            other => out.push(other),
        }
    }
    out
}

/// 目标路径是否位于工作区内；Windows 不区分大小写
pub fn is_inside(workspace: &Path, target: &Path) -> bool {
    let (root, target) = (normalize(workspace), normalize(target));
    if cfg!(windows) {
        let lower = |p: &Path| PathBuf::from(p.to_string_lossy().to_lowercase());
        lower(&target).starts_with(lower(&root))
    } else {
        target.starts_with(root)
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    name: String,
    path: String,
    is_directory: bool,
    created_at: u64,
    updated_at: u64,
    size: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    title: Option<String>,
    theme_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    children: Option<Vec<FileEntry>>,
}

fn millis(time: std::io::Result<std::time::SystemTime>) -> u64 {
    time.ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map_or(0, |d| d.as_millis() as u64)
}

fn unquote(raw: &str) -> String {
    let trimmed = raw.trim();
    let quoted = trimmed.len() >= 2
        && ((trimmed.starts_with('"') && trimmed.ends_with('"'))
            || (trimmed.starts_with('\'') && trimmed.ends_with('\'')));
    if !quoted {
        return trimmed.to_string();
    }
    let inner = &trimmed[1..trimmed.len() - 1];
    if trimmed.starts_with('"') {
        inner.replace("\\\"", "\"").replace("\\\\", "\\")
    } else {
        inner.replace("\\'", "'")
    }
}

/// 读取 frontmatter 里的 themeName 与 title
fn frontmatter_meta(head: &str) -> (String, Option<String>) {
    let mut theme_name = "默认主题".to_string();
    let mut title = None;
    let body = head.trim_start_matches('\u{feff}');
    let Some(rest) = body.strip_prefix("---\n").or_else(|| body.strip_prefix("---\r\n")) else {
        return (theme_name, title);
    };
    for line in rest.lines() {
        if line.trim_end() == "---" {
            break;
        }
        if let Some(value) = line.trim_start().strip_prefix("themeName:") {
            let value = unquote(value);
            if !value.is_empty() {
                theme_name = value;
            }
        } else if let Some(value) = line.trim_start().strip_prefix("title:") {
            let value = unquote(value);
            if !value.is_empty() {
                title = Some(value);
            }
        }
    }
    (theme_name, title)
}

fn read_file_entry(path: &Path) -> Option<FileEntry> {
    let meta = fs::metadata(path).ok()?;
    // 与 Electron 一致，只读前 1200 字节解析 frontmatter
    let mut head = Vec::with_capacity(1200);
    let _ = fs::File::open(path).and_then(|f| f.take(1200).read_to_end(&mut head));
    let (theme_name, title) = frontmatter_meta(&String::from_utf8_lossy(&head));
    Some(FileEntry {
        name: path.file_name()?.to_string_lossy().into_owned(),
        path: path.to_string_lossy().into_owned(),
        is_directory: false,
        created_at: millis(meta.created().or_else(|_| meta.modified())),
        updated_at: millis(meta.modified()),
        size: meta.len(),
        title,
        theme_name,
        children: None,
    })
}

/// 递归列出目录：子目录按名称在前，Markdown 文件按修改时间倒序在后，跳过隐藏项
pub fn scan(dir: &Path) -> Vec<FileEntry> {
    let Ok(entries) = fs::read_dir(dir) else {
        return Vec::new();
    };
    let (mut folders, mut files) = (Vec::new(), Vec::new());
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with('.') {
            continue;
        }
        let path = entry.path();
        match entry.file_type() {
            Ok(t) if t.is_dir() => folders.push((name, path)),
            Ok(t) if t.is_file() && name.ends_with(".md") => files.extend(read_file_entry(&path)),
            _ => {}
        }
    }
    folders.sort_by(|a, b| a.0.cmp(&b.0));
    files.sort_by_key(|f| std::cmp::Reverse(f.updated_at));
    let mut out: Vec<FileEntry> = folders
        .into_iter()
        .map(|(name, path)| {
            let meta = fs::metadata(&path).ok();
            FileEntry {
                children: Some(scan(&path)),
                name,
                path: path.to_string_lossy().into_owned(),
                is_directory: true,
                created_at: meta.as_ref().map_or(0, |m| millis(m.created())),
                updated_at: meta.as_ref().map_or(0, |m| millis(m.modified())),
                size: 0,
                title: None,
                theme_name: String::new(),
            }
        })
        .collect();
    out.extend(files);
    out
}

/// 同名文件存在时追加「 (1)」「 (2)」
pub fn unique_path(target: &Path) -> PathBuf {
    let dir = target.parent().unwrap_or(Path::new(""));
    let stem = target.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default();
    let ext = target.extension().map(|e| format!(".{}", e.to_string_lossy())).unwrap_or_default();
    let mut candidate = target.to_path_buf();
    let mut counter = 1;
    while candidate.exists() {
        candidate = dir.join(format!("{stem} ({counter}){ext}"));
        counter += 1;
    }
    candidate
}

/// 自定义主题存放在工作区 .wemd/themes.json，路径由工作区推导，不接受外部参数
pub fn theme_file(workspace: &Path) -> PathBuf {
    workspace.join(".wemd").join("themes.json")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_paths_escaping_workspace() {
        let root = Path::new("/home/u/ws");
        assert!(is_inside(root, Path::new("/home/u/ws/a.md")));
        assert!(is_inside(root, Path::new("/home/u/ws")));
        assert!(!is_inside(root, Path::new("/home/u/ws/../secret.md")));
        assert!(!is_inside(root, Path::new("/home/u/ws-other/a.md")));
    }

    #[test]
    fn reads_frontmatter_meta() {
        let head = "---\ntheme: x\nthemeName: \"学术论文\"\ntitle: 'It\\'s'\n---\n# 正文";
        assert_eq!(frontmatter_meta(head), ("学术论文".into(), Some("It's".into())));
        assert_eq!(frontmatter_meta("# 无 frontmatter"), ("默认主题".into(), None));
    }
}
