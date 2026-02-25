import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { Plus, Trash2, Edit2, Save } from "lucide-react";
import { useEditorStore } from "../../store/editorStore";
import { useFileStore } from "../../store/fileStore";
import { useThemeStore } from "../../store/themeStore";
import { useUITheme } from "../../hooks/useUITheme";
import { SidebarFooter } from "../Sidebar/SidebarFooter";
import type { StorageAdapter } from "../../storage/StorageAdapter";
import type { FileItem as StorageFileItem } from "../../storage/types";
import {
  applyMarkdownFileMeta,
  parseMarkdownFileContent,
  stripMarkdownExtension,
} from "../../utils/markdownFileMeta";

const defaultFsContent = `---
theme: default
themeName: 默认主题
title: 新文章
---

# 新文章

`;

function getFileTitle(file: StorageFileItem): string {
  const fromMeta =
    (file.meta as { title?: string } | undefined)?.title?.trim() || "";
  return fromMeta || stripMarkdownExtension(file.name);
}

function formatDate(value?: string | number | Date) {
  if (!value) return "";
  return new Date(value).toLocaleString();
}

function flattenFileItems(items: StorageFileItem[]): StorageFileItem[] {
  const result: StorageFileItem[] = [];
  for (const item of items) {
    const meta = item.meta as
      | { isDirectory?: boolean; children?: StorageFileItem[] }
      | undefined;
    if (meta?.isDirectory) {
      if (Array.isArray(meta.children)) {
        result.push(...flattenFileItems(meta.children));
      }
      continue;
    }
    if (item.name.endsWith(".md")) {
      result.push(item);
    }
  }
  return result;
}

interface FileSystemHistoryProps {
  adapter: StorageAdapter;
}

export function FileSystemHistory({ adapter }: FileSystemHistoryProps) {
  const setMarkdown = useEditorStore((state) => state.setMarkdown);
  const setFilePath = useEditorStore((state) => state.setFilePath);
  const currentFile = useFileStore((state) => state.currentFile);
  const setCurrentFile = useFileStore((state) => state.setCurrentFile);
  const setLastSavedContent = useFileStore(
    (state) => state.setLastSavedContent,
  );
  const setIsDirty = useFileStore((state) => state.setIsDirty);

  const selectTheme = useThemeStore((state) => state.selectTheme);
  const setCustomCSS = useThemeStore((state) => state.setCustomCSS);

  const [files, setFiles] = useState<StorageFileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StorageFileItem | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);

  const getDisplayTitle = (file: StorageFileItem) => {
    if (currentFile?.path === file.path && currentFile.title?.trim()) {
      return currentFile.title.trim();
    }
    return getFileTitle(file);
  };

  const refreshFiles = useCallback(async () => {
    setLoading(true);
    try {
      const list = await adapter.listFiles();
      const flatFiles = flattenFileItems(list);
      const sorted = [...flatFiles].sort((a, b) => {
        const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return timeB - timeA;
      });
      setFiles(sorted);
      if (activePath && !sorted.find((item) => item.path === activePath)) {
        setActivePath(null);
      }
    } catch (error) {
      console.error(error);
      toast.error("无法加载文件列表");
    } finally {
      setLoading(false);
    }
  }, [adapter, activePath]);

  useEffect(() => {
    void refreshFiles();
  }, [refreshFiles]);

  const handleOpen = async (file: StorageFileItem) => {
    try {
      const content = await adapter.readFile(file.path);
      const parsed = parseMarkdownFileContent(content);
      const resolvedTitle = parsed.title || getFileTitle(file);
      setMarkdown(parsed.body);
      selectTheme(parsed.theme);
      setCustomCSS("");
      setFilePath(file.path);
      setActivePath(file.path);
      const updatedAt = file.updatedAt ? new Date(file.updatedAt) : new Date();
      setCurrentFile({
        name: file.name,
        path: file.path,
        createdAt: updatedAt,
        updatedAt,
        size: file.size ?? 0,
        title: resolvedTitle,
        themeName: parsed.themeName,
      });
      setLastSavedContent(content);
      setIsDirty(false);
      toast.success(`已打开: ${resolvedTitle}`);
    } catch (error) {
      console.error(error);
      toast.error("打开文件失败");
    }
  };

  const handleCreate = async () => {
    try {
      const fileName = `文稿-${Date.now()}.md`;
      await adapter.writeFile(fileName, defaultFsContent);
      await refreshFiles();
      await handleOpen({ path: fileName, name: fileName } as StorageFileItem);
    } catch (error) {
      console.error(error);
      toast.error("创建文件失败");
    }
  };

  const handleSave = async () => {
    if (!activePath) {
      toast("请先打开文件", { icon: "ℹ️" });
      return;
    }
    try {
      setSaving(true);
      const editorState = useEditorStore.getState();
      const themeState = useThemeStore.getState();
      const activeFile = files.find((item) => item.path === activePath);
      const fallbackTitle = activeFile
        ? stripMarkdownExtension(activeFile.name)
        : "未命名文章";
      const resolvedTitle =
        currentFile?.path === activePath && currentFile.title?.trim()
          ? currentFile.title.trim()
          : fallbackTitle;
      const baseContent =
        currentFile?.path === activePath
          ? useFileStore.getState().lastSavedContent
          : await adapter.readFile(activePath);
      const nextContent = applyMarkdownFileMeta(baseContent, {
        body: editorState.markdown,
        theme: themeState.themeId,
        themeName: themeState.themeName,
        title: resolvedTitle,
      });
      await adapter.writeFile(activePath, nextContent);
      if (currentFile?.path === activePath) {
        setLastSavedContent(nextContent);
        setIsDirty(false);
      }
      toast.success("已保存当前文件");
      await refreshFiles();
    } catch (error) {
      console.error(error);
      toast.error("保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (file: StorageFileItem) => {
    setDeleteTarget(file);
  };

  const submitRename = async () => {
    if (!renamingPath || !renameValue.trim()) return;
    const nextTitle = renameValue.trim();
    try {
      const current = await adapter.readFile(renamingPath);
      const nextContent = applyMarkdownFileMeta(current, {
        title: nextTitle,
      });
      await adapter.writeFile(renamingPath, nextContent);
      toast.success("标题已更新");
      if (currentFile?.path === renamingPath) {
        setCurrentFile({ ...currentFile, title: nextTitle });
        if (!useFileStore.getState().isDirty) {
          setLastSavedContent(nextContent);
        }
      }
      setRenamingPath(null);
      setRenameValue("");
      await refreshFiles();
    } catch (error) {
      console.error(error);
      toast.error("更新标题失败");
    }
  };

  const uiTheme = useUITheme((state) => state.theme);
  const logoSrc =
    uiTheme === "dark" ? "/favicon-light.svg" : "/favicon-dark.svg";

  return (
    <aside className="history-sidebar">
      <div className="history-header">
        <h3>文件列表</h3>
        <div className="history-actions">
          <button
            className="btn-secondary btn-icon-only"
            onClick={handleCreate}
            data-tooltip="新建文章"
          >
            <Plus size={16} />
          </button>
          <button
            className="btn-secondary btn-icon-only"
            onClick={handleSave}
            disabled={!activePath || saving}
            data-tooltip="保存当前"
          >
            <Save size={16} />
          </button>
        </div>
      </div>
      <div className="history-body">
        {loading ? (
          <div className="history-empty">正在加载...</div>
        ) : files.length === 0 ? (
          <div className="history-empty">暂无文件</div>
        ) : (
          <div className="history-list">
            {files.map((file) => (
              <div
                key={file.path}
                className={`history-item ${activePath === file.path ? "active" : ""}`}
                onClick={() => handleOpen(file)}
              >
                <div className="history-item-main">
                  <div className="history-title-block">
                    <span className="history-time">
                      {formatDate(file.updatedAt)}
                    </span>
                    {renamingPath === file.path ? (
                      <div
                        className="history-rename"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") submitRename();
                            if (e.key === "Escape") setRenamingPath(null);
                          }}
                          autoFocus
                        />
                        <button onClick={submitRename}>确认</button>
                        <button onClick={() => setRenamingPath(null)}>
                          取消
                        </button>
                      </div>
                    ) : (
                      <span className="history-title">
                        {getDisplayTitle(file)}
                      </span>
                    )}
                    <span className="history-theme">本地文件</span>
                  </div>
                  <div className="history-actions-menu-wrapper">
                    {renamingPath !== file.path && (
                      <>
                        <button
                          className="history-action-trigger"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRenamingPath(file.path);
                            setRenameValue(getDisplayTitle(file));
                          }}
                          aria-label="重命名"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          className="history-action-trigger"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(file);
                          }}
                          aria-label="删除"
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <SidebarFooter />
      {deleteTarget &&
        createPortal(
          <div
            className="history-confirm-backdrop"
            onClick={() => !deleting && setDeleteTarget(null)}
          >
            <div
              className="history-confirm-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <h4>删除文件</h4>
              <p>确定要删除"{deleteTarget.name}"吗？此操作不可撤销。</p>
              <div className="history-confirm-actions">
                <button
                  className="btn-secondary"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                >
                  取消
                </button>
                <button
                  className="btn-danger"
                  onClick={async () => {
                    setDeleting(true);
                    try {
                      await adapter.deleteFile(deleteTarget.path);
                      toast.success("已删除文件");
                      if (activePath === deleteTarget.path) {
                        setActivePath(null);
                        setMarkdown("");
                        setFilePath("");
                        setCurrentFile(null);
                        setLastSavedContent("");
                        setIsDirty(false);
                      }
                      await refreshFiles();
                    } catch (error) {
                      console.error(error);
                      toast.error("删除失败");
                    } finally {
                      setDeleting(false);
                      setDeleteTarget(null);
                    }
                  }}
                  disabled={deleting}
                >
                  {deleting ? "删除中..." : "确认删除"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </aside>
  );
}
