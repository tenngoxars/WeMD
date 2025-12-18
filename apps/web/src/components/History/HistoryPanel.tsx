import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { Search, Plus, Trash2, MoreHorizontal, Edit2, Copy, Save } from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import { useThemeStore } from '../../store/themeStore';
import { useHistoryStore } from '../../store/historyStore';
import type { HistorySnapshot } from '../../store/historyStore';
import { useStorageContext } from '../../storage/StorageContext';
import type { StorageAdapter } from '../../storage/StorageAdapter';
import type { FileItem as StorageFileItem } from '../../storage/types';
import './HistoryPanel.css';

// 每次加载的记录数量
const PAGE_SIZE = 50;

const defaultFsContent = `---
theme: default
themeName: 默认主题
---

# 新文章

`;

function parseFsFrontmatter(content: string) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    return {
      body: content,
      theme: 'default',
      themeName: '默认主题',
    };
  }
  const raw = match[1];
  const body = content.slice(match[0].length).trimStart();
  const theme = raw.match(/theme:\s*(.+)/)?.[1]?.trim() ?? 'default';
  const themeName = raw.match(/themeName:\s*(.+)/)?.[1]?.trim()?.replace(/^['"]|['"]$/g, '') ?? '默认主题';
  return { body, theme, themeName };
}

function formatDate(value?: string | number | Date) {
  if (!value) return '';
  return new Date(value).toLocaleString();
}

export function HistoryPanel() {
  const { adapter, type } = useStorageContext();
  if (type === 'filesystem' && adapter) {
    return <FileSystemHistory adapter={adapter} />;
  }
  return <IndexedHistoryPanel />;
}

function IndexedHistoryPanel() {
  const history = useHistoryStore((state) => state.history);
  const loading = useHistoryStore((state) => state.loading);
  const filter = useHistoryStore((state) => state.filter);
  const setFilter = useHistoryStore((state) => state.setFilter);
  const deleteEntry = useHistoryStore((state) => state.deleteEntry);
  const clearHistory = useHistoryStore((state) => state.clearHistory);
  const saveSnapshot = useHistoryStore((state) => state.saveSnapshot);
  const updateTitle = useHistoryStore((state) => state.updateTitle);
  const persistActive = useHistoryStore((state) => state.persistActiveSnapshot);
  const activeId = useHistoryStore((state) => state.activeId);
  const setActiveId = useHistoryStore((state) => state.setActiveId);
  const loadHistory = useHistoryStore((state) => state.loadHistory);

  const setMarkdown = useEditorStore((state) => state.setMarkdown);
  const resetDocument = useEditorStore((state) => state.resetDocument);

  // 主题相关状态从 themeStore 获取
  const themeName = useThemeStore((state) => state.themeName);
  const selectTheme = useThemeStore((state) => state.selectTheme);
  const setCustomCSS = useThemeStore((state) => state.setCustomCSS);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [tempTitle, setTempTitle] = useState<string>('未命名文章');
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [menuEntry, setMenuEntry] = useState<HistorySnapshot | null>(null);

  // 无限滚动状态
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<HistorySnapshot | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleRestore = async (entry?: HistorySnapshot) => {
    if (!entry) return;
    const editorState = useEditorStore.getState();
    const themeState = useThemeStore.getState();
    await persistActive({
      markdown: editorState.markdown,
      theme: themeState.themeId,
      customCSS: themeState.customCSS,
      themeName,
    });
    setMarkdown(entry.markdown);
    selectTheme(entry.theme);
    setCustomCSS(entry.customCSS);
    setActiveId(entry.id);
    setRenamingId(null);
    setActionMenuId(null);
  };

  const handleDelete = async (id: string) => {
    await deleteEntry(id);
    if (renamingId === id) {
      setRenamingId(null);
    }
    if (activeId === id) {
      const { history: updatedHistory, activeId: nextActive } = useHistoryStore.getState();
      if (nextActive) {
        const nextEntry = updatedHistory.find((item) => item.id === nextActive);
        if (nextEntry) {
          setMarkdown(nextEntry.markdown);
          selectTheme(nextEntry.theme);
          setCustomCSS(nextEntry.customCSS);
        }
      } else {
        resetDocument();
      }
    }
  };

  const handleCreateArticle = async () => {
    const initial = '# 新文章\n\n';
    const editorState = useEditorStore.getState();
    const themeState = useThemeStore.getState();
    await persistActive({
      markdown: editorState.markdown,
      theme: themeState.themeId,
      customCSS: themeState.customCSS,
      themeName,
    });
    resetDocument({ markdown: initial, theme: 'default', customCSS: '', themeName });
    const newEntry = await saveSnapshot(
      { markdown: initial, theme: 'default', customCSS: '', title: '新文章', themeName },
      { force: true },
    );
    if (newEntry) {
      setActiveId(newEntry.id);
    }
    toast.success('已创建新文章');
  };

  const startRename = (entry: HistorySnapshot) => {
    setRenamingId(entry.id);
    setTempTitle(entry.title || '未命名文章');
    setActionMenuId(null);
    setMenuEntry(null);
  };

  const confirmRename = async (entry: HistorySnapshot) => {
    await updateTitle(entry.id, tempTitle);
    toast.success('标题已更新');
    setRenamingId(null);
  };

  const copyTitle = async (entry: HistorySnapshot) => {
    try {
      await navigator.clipboard.writeText(entry.title || '未命名文章');
      toast.success('标题已复制');
    } catch (error) {
      console.error(error);
      toast.error('复制失败');
    }
  };

  const handleMenuToggle = (event: React.MouseEvent, entry: HistorySnapshot) => {
    event.stopPropagation();
    const button = event.currentTarget as HTMLElement;
    const rect = button.getBoundingClientRect();
    const width = 180;
    const padding = 12;
    const maxLeft = window.innerWidth - width - padding;
    const minLeft = padding;
    const desiredLeft = rect.right - width;
    const left = Math.max(minLeft, Math.min(maxLeft, desiredLeft));
    const top = rect.bottom + 8;

    if (actionMenuId === entry.id) {
      setActionMenuId(null);
      setMenuEntry(null);
      return;
    }

    setActionMenuId(entry.id);
    setMenuEntry(entry);
    setMenuPosition({ top, left });
  };

  const closeActionMenu = () => {
    setActionMenuId(null);
    setMenuEntry(null);
  };

  useEffect(() => {
    const handleWindowClick = () => closeActionMenu();
    const handleWindowScroll = () => closeActionMenu();
    window.addEventListener('click', handleWindowClick);
    window.addEventListener('scroll', handleWindowScroll, true);
    return () => {
      window.removeEventListener('click', handleWindowClick);
      window.removeEventListener('scroll', handleWindowScroll, true);
    };
  }, []);

  // 组件挂载时加载历史记录
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const sidebarClass = 'history-sidebar';
  const keyword = filter.trim().toLowerCase();
  const filteredHistory = useMemo(() => {
    if (!keyword) return history;
    return history.filter((entry) =>
      (entry.title || '未命名文章').toLowerCase().includes(keyword),
    );
  }, [history, keyword]);

  // 当前可见的历史记录
  const visibleHistory = useMemo(() => {
    return filteredHistory.slice(0, visibleCount);
  }, [filteredHistory, visibleCount]);

  // 是否还有更多记录可加载
  const hasMore = visibleCount < filteredHistory.length;

  // 加载更多记录
  const loadMore = useCallback(() => {
    if (hasMore) {
      setVisibleCount(prev => Math.min(prev + PAGE_SIZE, filteredHistory.length));
    }
  }, [hasMore, filteredHistory.length]);

  // 使用 Intersection Observer 检测滚动到底部
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  // 搜索条件变化时重置可见数量
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filter]);

  const hasEntries = filteredHistory.length > 0;

  return (
    <>
      <aside className={sidebarClass}>
        <div className="history-header">
          <h3>历史记录</h3>
          <div className="history-actions">
            <button className="btn-secondary btn-icon-only" onClick={handleCreateArticle} data-tooltip="新增文章">
              <Plus size={16} />
            </button>
            <button
              className="btn-secondary btn-icon-only"
              onClick={() => setShowClearConfirm(true)}
              data-tooltip="清空历史"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
        <div className="history-search">
          <div className="search-wrapper">
            <Search size={14} className="search-icon" />
            <input
              type="text"
              placeholder="搜索..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
        </div>
        {loading ? (
          <div className="history-empty">正在加载...</div>
        ) : !hasEntries ? (
          <div className="history-empty">
            {filter ? '无匹配结果' : '暂无记录'}
          </div>
        ) : (
          <div className="history-body">
            <div className="history-list">
              {visibleHistory.map((entry) => (
                <div
                  key={entry.id}
                  className={`history-item ${activeId === entry.id ? 'active' : ''}`}
                  onClick={() => handleRestore(entry)}
                >
                  <div className="history-item-main">
                    <div className="history-title-block">
                      <span className="history-time">{new Date(entry.savedAt).toLocaleString()}</span>
                      {renamingId === entry.id ? (
                        <div className="history-rename" onClick={(e) => e.stopPropagation()}>
                          <input
                            value={tempTitle}
                            onChange={(e) => setTempTitle(e.target.value)}
                            autoFocus
                          />
                          <button onClick={() => confirmRename(entry)}>确认</button>
                          <button onClick={() => setRenamingId(null)}>取消</button>
                        </div>
                      ) : (
                        <span className="history-title">{entry.title || '未命名文章'}</span>
                      )}
                      <span className="history-theme">{entry.themeName || '未命名主题'}</span>
                    </div>
                    <div className="history-actions-menu-wrapper">
                      <button
                        className="history-action-trigger"
                        onClick={(e) => handleMenuToggle(e, entry)}
                        aria-label="操作菜单"
                      >
                        <MoreHorizontal size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {/* 无限滚动触发器 */}
              {hasMore && (
                <div ref={loadMoreRef} className="history-load-more">
                  <span>加载更多...</span>
                </div>
              )}
            </div>
          </div>
        )}
      </aside>
      {actionMenuId && menuEntry &&
        createPortal(
          <div
            className="history-action-menu"
            style={{ top: menuPosition.top, left: menuPosition.left }}
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => { copyTitle(menuEntry); closeActionMenu(); }}>
              <Copy size={14} />
              复制标题
            </button>
            <button onClick={() => { startRename(menuEntry); closeActionMenu(); }}>
              <Edit2 size={14} />
              重命名
            </button>
            <button className="danger" onClick={() => { setDeleteTarget(menuEntry); closeActionMenu(); }}>
              <Trash2 size={14} />
              删除
            </button>
          </div>,
          document.body,
        )}
      {deleteTarget &&
        createPortal(
          <div className="history-confirm-backdrop" onClick={() => !deleting && setDeleteTarget(null)}>
            <div className="history-confirm-modal" onClick={(e) => e.stopPropagation()}>
              <h4>删除记录</h4>
              <p>确定要删除“{deleteTarget.title || '未命名文章'}”吗？此操作不可撤销。</p>
              <div className="history-confirm-actions">
                <button className="btn-secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                  取消
                </button>
                <button
                  className="btn-danger"
                  onClick={async () => {
                    setDeleting(true);
                    try {
                      await handleDelete(deleteTarget.id);
                      toast.success('已删除该记录');
                    } finally {
                      setDeleting(false);
                      setDeleteTarget(null);
                    }
                  }}
                  disabled={deleting}
                >
                  {deleting ? '删除中...' : '确认删除'}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
      {showClearConfirm &&
        createPortal(
          <div className="history-confirm-backdrop" onClick={() => !clearing && setShowClearConfirm(false)}>
            <div className="history-confirm-modal" onClick={(e) => e.stopPropagation()}>
              <h4>清空历史</h4>
              <p>确定要清空所有历史记录吗？此操作不可撤销。</p>
              <div className="history-confirm-actions">
                <button className="btn-secondary" onClick={() => setShowClearConfirm(false)} disabled={clearing}>
                  取消
                </button>
                <button
                  className="btn-danger"
                  onClick={async () => {
                    setClearing(true);
                    try {
                      await clearHistory();
                      resetDocument();
                      toast.success('历史记录已清空');
                    } finally {
                      setClearing(false);
                      setShowClearConfirm(false);
                    }
                  }}
                  disabled={clearing}
                >
                  {clearing ? '清空中...' : '确认清空'}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function FileSystemHistory({ adapter }: { adapter: StorageAdapter }) {
  const setMarkdown = useEditorStore((state) => state.setMarkdown);
  const setFilePath = useEditorStore((state) => state.setFilePath);

  // 主题相关状态从 themeStore 获取
  const selectTheme = useThemeStore((state) => state.selectTheme);
  const setCustomCSS = useThemeStore((state) => state.setCustomCSS);

  const [files, setFiles] = useState<StorageFileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StorageFileItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const refreshFiles = useCallback(async () => {
    setLoading(true);
    try {
      const list = await adapter.listFiles();
      setFiles(list);
      if (activePath && !list.find((item) => item.path === activePath)) {
        setActivePath(null);
      }
    } catch (error) {
      console.error(error);
      toast.error('无法加载文件列表');
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
      const parsed = parseFsFrontmatter(content);
      setMarkdown(parsed.body);
      selectTheme(parsed.theme);
      setCustomCSS('');
      setFilePath(file.path);
      setActivePath(file.path);
      toast.success(`已打开: ${file.name}`);
    } catch (error) {
      console.error(error);
      toast.error('打开文件失败');
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
      toast.error('创建文件失败');
    }
  };

  const handleSave = async () => {
    if (!activePath) {
      toast('请先打开文件', { icon: 'ℹ️' });
      return;
    }
    try {
      setSaving(true);
      const editorState = useEditorStore.getState();
      const themeState = useThemeStore.getState();
      const frontmatter = `---
theme: ${themeState.themeId}
themeName: ${themeState.themeName}
---
`;
      await adapter.writeFile(activePath, `${frontmatter}\n${editorState.markdown}`);
      toast.success('已保存当前文件');
      await refreshFiles();
    } catch (error) {
      console.error(error);
      toast.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (file: StorageFileItem) => {
    setDeleteTarget(file);
  };

  const submitRename = async () => {
    if (!renamingPath || !renameValue.trim()) return;
    const nextName = renameValue.trim().endsWith('.md') ? renameValue.trim() : `${renameValue.trim()}.md`;
    try {
      await adapter.renameFile(renamingPath, nextName);
      toast.success('重命名成功');
      if (activePath === renamingPath) {
        setActivePath(nextName);
        setFilePath(nextName);
      }
      setRenamingPath(null);
      setRenameValue('');
      await refreshFiles();
    } catch (error) {
      console.error(error);
      toast.error('重命名失败');
    }
  };

  return (
    <aside className="history-sidebar">
      <div className="history-header">
        <h3>文件列表</h3>
        <div className="history-actions">
          <button className="btn-secondary btn-icon-only" onClick={handleCreate} data-tooltip="新建文章">
            <Plus size={16} />
          </button>
          <button className="btn-secondary btn-icon-only" onClick={handleSave} disabled={!activePath || saving} data-tooltip="保存当前">
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
                className={`history-item ${activePath === file.path ? 'active' : ''}`}
                onClick={() => handleOpen(file)}
              >
                <div className="history-item-main">
                  <div className="history-title-block">
                    <span className="history-time">{formatDate(file.updatedAt)}</span>
                    {renamingPath === file.path ? (
                      <div className="history-rename" onClick={(e) => e.stopPropagation()}>
                        <input
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') submitRename();
                            if (e.key === 'Escape') setRenamingPath(null);
                          }}
                          autoFocus
                        />
                        <button onClick={submitRename}>确认</button>
                        <button onClick={() => setRenamingPath(null)}>取消</button>
                      </div>
                    ) : (
                      <span className="history-title">{file.name}</span>
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
                            setRenameValue(file.name.replace(/\.md$/, ''));
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
      {deleteTarget &&
        createPortal(
          <div className="history-confirm-backdrop" onClick={() => !deleting && setDeleteTarget(null)}>
            <div className="history-confirm-modal" onClick={(e) => e.stopPropagation()}>
              <h4>删除文件</h4>
              <p>确定要删除“{deleteTarget.name}”吗？此操作不可撤销。</p>
              <div className="history-confirm-actions">
                <button className="btn-secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                  取消
                </button>
                <button
                  className="btn-danger"
                  onClick={async () => {
                    setDeleting(true);
                    try {
                      await adapter.deleteFile(deleteTarget.path);
                      toast.success('已删除文件');
                      if (activePath === deleteTarget.path) {
                        setActivePath(null);
                        setMarkdown('');
                        setFilePath('');
                      }
                      await refreshFiles();
                    } catch (error) {
                      console.error(error);
                      toast.error('删除失败');
                    } finally {
                      setDeleting(false);
                      setDeleteTarget(null);
                    }
                  }}
                  disabled={deleting}
                >
                  {deleting ? '删除中...' : '确认删除'}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </aside>
  );
}
