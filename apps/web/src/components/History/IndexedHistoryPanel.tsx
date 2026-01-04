import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import {
  Search,
  Plus,
  Trash2,
  MoreHorizontal,
  Edit2,
  Copy,
  Github,
  Globe,
  BookOpen,
} from "lucide-react";
import { useEditorStore } from "../../store/editorStore";
import { useThemeStore } from "../../store/themeStore";
import { useHistoryStore } from "../../store/historyStore";
import type { HistorySnapshot } from "../../store/historyStore";

const PAGE_SIZE = 50;

export function IndexedHistoryPanel() {
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

  const themeName = useThemeStore((state) => state.themeName);
  const selectTheme = useThemeStore((state) => state.selectTheme);
  const setCustomCSS = useThemeStore((state) => state.setCustomCSS);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [tempTitle, setTempTitle] = useState<string>("未命名文章");
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    left: number;
  }>({ top: 0, left: 0 });
  const [menuEntry, setMenuEntry] = useState<HistorySnapshot | null>(null);

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<HistorySnapshot | null>(
    null,
  );
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
      const { history: updatedHistory, activeId: nextActive } =
        useHistoryStore.getState();
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
    const initial = "# 新文章\n\n";
    const editorState = useEditorStore.getState();
    const themeState = useThemeStore.getState();
    await persistActive({
      markdown: editorState.markdown,
      theme: themeState.themeId,
      customCSS: themeState.customCSS,
      themeName,
    });
    resetDocument({
      markdown: initial,
      theme: "default",
      customCSS: "",
      themeName,
    });
    const newEntry = await saveSnapshot(
      {
        markdown: initial,
        theme: "default",
        customCSS: "",
        title: "新文章",
        themeName,
      },
      { force: true },
    );
    if (newEntry) {
      setActiveId(newEntry.id);
    }
    toast.success("已创建新文章");
  };

  const startRename = (entry: HistorySnapshot) => {
    setRenamingId(entry.id);
    setTempTitle(entry.title || "未命名文章");
    setActionMenuId(null);
    setMenuEntry(null);
  };

  const confirmRename = async (entry: HistorySnapshot) => {
    await updateTitle(entry.id, tempTitle);
    toast.success("标题已更新");
    setRenamingId(null);
  };

  const copyTitle = async (entry: HistorySnapshot) => {
    try {
      await navigator.clipboard.writeText(entry.title || "未命名文章");
      toast.success("标题已复制");
    } catch (error) {
      console.error(error);
      toast.error("复制失败");
    }
  };

  const handleMenuToggle = (
    event: React.MouseEvent,
    entry: HistorySnapshot,
  ) => {
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
    window.addEventListener("click", handleWindowClick);
    window.addEventListener("scroll", handleWindowScroll, true);
    return () => {
      window.removeEventListener("click", handleWindowClick);
      window.removeEventListener("scroll", handleWindowScroll, true);
    };
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const sidebarClass = "history-sidebar";
  const keyword = filter.trim().toLowerCase();
  const filteredHistory = useMemo(() => {
    if (!keyword) return history;
    return history.filter((entry) =>
      (entry.title || "未命名文章").toLowerCase().includes(keyword),
    );
  }, [history, keyword]);

  const visibleHistory = useMemo(() => {
    return filteredHistory.slice(0, visibleCount);
  }, [filteredHistory, visibleCount]);

  const hasMore = visibleCount < filteredHistory.length;

  const loadMore = useCallback(() => {
    if (hasMore) {
      setVisibleCount((prev) =>
        Math.min(prev + PAGE_SIZE, filteredHistory.length),
      );
    }
  }, [hasMore, filteredHistory.length]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          loadMore();
        }
      },
      { threshold: 0.1 },
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loadMore]);

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
            <button
              className="btn-secondary btn-icon-only"
              onClick={handleCreateArticle}
              data-tooltip="新增文章"
            >
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
            {filter ? "无匹配结果" : "暂无记录"}
          </div>
        ) : (
          <div className="history-body">
            <div className="history-list">
              {visibleHistory.map((entry) => (
                <div
                  key={entry.id}
                  className={`history-item ${activeId === entry.id ? "active" : ""}`}
                  onClick={() => handleRestore(entry)}
                >
                  <div className="history-item-main">
                    <div className="history-title-block">
                      <span className="history-time">
                        {new Date(entry.savedAt).toLocaleString()}
                      </span>
                      {renamingId === entry.id ? (
                        <div
                          className="history-rename"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            value={tempTitle}
                            onChange={(e) => setTempTitle(e.target.value)}
                            autoFocus
                          />
                          <button onClick={() => confirmRename(entry)}>
                            确认
                          </button>
                          <button onClick={() => setRenamingId(null)}>
                            取消
                          </button>
                        </div>
                      ) : (
                        <span className="history-title">
                          {entry.title || "未命名文章"}
                        </span>
                      )}
                      <span className="history-theme">
                        {entry.themeName || "未命名主题"}
                      </span>
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
              {hasMore && (
                <div ref={loadMoreRef} className="history-load-more">
                  <span>加载更多...</span>
                </div>
              )}
            </div>
          </div>
        )}
        <div className="history-sidebar-footer">
          <div className="history-footer-brand">
            <div className="history-footer-logo">
              <img src="./favicon-dark.svg" alt="Logo" />
            </div>
            <div className="history-footer-info">
              <span className="history-footer-name">WeMD</span>
              <span className="history-footer-version">v{__APP_VERSION__}</span>
            </div>
          </div>
          <div className="history-footer-links">
            <a
              href="https://github.com/tenngoxars/WeMD"
              target="_blank"
              rel="noopener noreferrer"
              data-tooltip="GitHub 仓库"
              aria-label="GitHub 仓库"
            >
              <Github size={16} />
            </a>
            <a
              href="https://wemd.app"
              target="_blank"
              rel="noopener noreferrer"
              data-tooltip="官方网站"
              aria-label="官方网站"
            >
              <Globe size={16} />
            </a>
            <a
              href="https://wemd.app/docs"
              target="_blank"
              rel="noopener noreferrer"
              data-tooltip="帮助文档"
              aria-label="帮助文档"
            >
              <BookOpen size={16} />
            </a>
          </div>
        </div>
      </aside>
      {actionMenuId &&
        menuEntry &&
        createPortal(
          <div
            className="history-action-menu"
            style={{ top: menuPosition.top, left: menuPosition.left }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                copyTitle(menuEntry);
                closeActionMenu();
              }}
            >
              <Copy size={14} />
              复制标题
            </button>
            <button
              onClick={() => {
                startRename(menuEntry);
                closeActionMenu();
              }}
            >
              <Edit2 size={14} />
              重命名
            </button>
            <button
              className="danger"
              onClick={() => {
                setDeleteTarget(menuEntry);
                closeActionMenu();
              }}
            >
              <Trash2 size={14} />
              删除
            </button>
          </div>,
          document.body,
        )}
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
              <h4>删除记录</h4>
              <p>
                确定要删除"{deleteTarget.title || "未命名文章"}
                "吗？此操作不可撤销。
              </p>
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
                      await handleDelete(deleteTarget.id);
                      toast.success("已删除该记录");
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
      {showClearConfirm &&
        createPortal(
          <div
            className="history-confirm-backdrop"
            onClick={() => !clearing && setShowClearConfirm(false)}
          >
            <div
              className="history-confirm-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <h4>清空历史</h4>
              <p>确定要清空所有历史记录吗？此操作不可撤销。</p>
              <div className="history-confirm-actions">
                <button
                  className="btn-secondary"
                  onClick={() => setShowClearConfirm(false)}
                  disabled={clearing}
                >
                  取消
                </button>
                <button
                  className="btn-danger"
                  onClick={async () => {
                    setClearing(true);
                    try {
                      await clearHistory();
                      resetDocument();
                      toast.success("历史记录已清空");
                    } finally {
                      setClearing(false);
                      setShowClearConfirm(false);
                    }
                  }}
                  disabled={clearing}
                >
                  {clearing ? "清空中..." : "确认清空"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
