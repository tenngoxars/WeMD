import { useCallback, useEffect, useRef } from "react";
import { useEditorStore, defaultMarkdown } from "../../store/editorStore";
import { useThemeStore } from "../../store/themeStore";
import { useHistoryStore } from "../../store/historyStore";

const AUTO_SAVE_INTERVAL = 10 * 1000; // 10 秒 - Web 存储的较好平衡点
const UNTITLED_TITLE = "未命名文章";

function deriveTitle(markdown: string) {
  const trimmed = markdown.trim();
  if (!trimmed) return UNTITLED_TITLE;
  const headingMatch = trimmed.match(/^(#+)\s*(.+)$/m);
  if (headingMatch) {
    return headingMatch[2].trim().slice(0, 50) || UNTITLED_TITLE;
  }
  const firstLine = trimmed.split(/\r?\n/).find((line) => line.trim());
  return firstLine ? firstLine.trim().slice(0, 50) : UNTITLED_TITLE;
}

export function HistoryManager() {
  const markdown = useEditorStore((state) => state.markdown);
  const setMarkdown = useEditorStore((state) => state.setMarkdown);
  const setFilePath = useEditorStore((state) => state.setFilePath);
  const setWorkspaceDir = useEditorStore((state) => state.setWorkspaceDir);

  // 主题相关状态从 themeStore 获取
  const theme = useThemeStore((state) => state.themeId);
  const customCSS = useThemeStore((state) => state.customCSS);
  const themeName = useThemeStore((state) => state.themeName);
  const selectTheme = useThemeStore((state) => state.selectTheme);
  const setCustomCSS = useThemeStore((state) => state.setCustomCSS);

  const persistActiveSnapshot = useHistoryStore(
    (state) => state.persistActiveSnapshot,
  );
  const saveSnapshot = useHistoryStore((state) => state.saveSnapshot);
  const loadHistory = useHistoryStore((state) => state.loadHistory);
  const history = useHistoryStore((state) => state.history);
  const activeId = useHistoryStore((state) => state.activeId);
  const setActiveId = useHistoryStore((state) => state.setActiveId);
  const loading = useHistoryStore((state) => state.loading);

  const latestRef = useRef({ markdown, theme, customCSS, themeName });
  const prevMarkdownRef = useRef(markdown);
  const isInitialMountRef = useRef(true);
  const isRestoringRef = useRef(false);
  const hasUserEditedRef = useRef(false);
  const hasAppliedInitialHistoryRef = useRef(false);
  const creatingInitialSnapshotRef = useRef(false);
  const hasLoadedHistoryRef = useRef(false);
  const wasLoadingRef = useRef(false);
  const restoringContentRef = useRef<string | null>(null);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // 跟踪加载生命周期
  useEffect(() => {
    if (loading) {
      wasLoadingRef.current = true;
    } else if (wasLoadingRef.current) {
      hasLoadedHistoryRef.current = true;
    }
  }, [loading]);

  useEffect(() => {
    latestRef.current = { markdown, theme, customCSS, themeName };

    const markdownChanged = markdown !== prevMarkdownRef.current;
    prevMarkdownRef.current = markdown;

    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }

    // 检查当前变化是否与正在恢复的内容匹配
    if (
      restoringContentRef.current !== null &&
      markdown === restoringContentRef.current
    ) {
      restoringContentRef.current = null; // Reset
      return; // Skip marking as edited
    }

    // 只有在以下条件满足时才标记为已编辑：
    // 1. Markdown 实际发生了变化
    // 2. 当前不是在恢复中（保留旧检查以确保安全）
    // 3. 当前不是在加载中
    // 4. 历史记录已至少加载完成一次
    if (
      markdownChanged &&
      !isRestoringRef.current &&
      !loading &&
      hasLoadedHistoryRef.current
    ) {
      hasUserEditedRef.current = true;
    }

    if (creatingInitialSnapshotRef.current) return;

    const {
      activeId: currentActiveId,
      history: currentHistory,
      loading: storeLoading,
    } = useHistoryStore.getState();
    if (storeLoading) return;

    if (!currentActiveId && currentHistory.length === 0 && markdown.trim()) {
      creatingInitialSnapshotRef.current = true;
      void saveSnapshot(
        {
          markdown,
          theme,
          customCSS,
          title: deriveTitle(markdown),
          themeName,
        },
        { force: true },
      ).finally(() => {
        creatingInitialSnapshotRef.current = false;
      });
    }
  }, [markdown, theme, customCSS, themeName, saveSnapshot, loading]);

  const persistLatestSnapshot = useCallback(async () => {
    const snapshot = latestRef.current;
    if (!snapshot.markdown.trim()) return;

    // 如果用户未编辑或当前正在恢复历史记录，则阻止自动保存
    if (!hasUserEditedRef.current || isRestoringRef.current) {
      return;
    }

    const {
      activeId: currentActiveId,
      history: currentHistory,
      loading: storeLoading,
    } = useHistoryStore.getState();
    if (storeLoading) return;

    if (!currentActiveId) {
      if (currentHistory.length === 0) {
        await saveSnapshot(
          {
            markdown: snapshot.markdown,
            theme: snapshot.theme,
            customCSS: snapshot.customCSS,
            title: deriveTitle(snapshot.markdown),
            themeName: snapshot.themeName,
          },
          { force: true },
        );
      }
      return;
    }

    await persistActiveSnapshot({
      markdown: snapshot.markdown,
      theme: snapshot.theme,
      customCSS: snapshot.customCSS,
      themeName: snapshot.themeName,
    });
  }, [persistActiveSnapshot, saveSnapshot]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void persistLatestSnapshot();
    }, AUTO_SAVE_INTERVAL);
    return () => window.clearInterval(intervalId);
  }, [persistLatestSnapshot]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      void persistLatestSnapshot();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [persistLatestSnapshot]);

  useEffect(() => {
    // 历史记录为空时，显示示例文章
    if (!history.length) {
      hasAppliedInitialHistoryRef.current = false;
      // 只有在加载完成后才填充示例，避免加载过程中的闪烁
      if (hasLoadedHistoryRef.current) {
        const latest = latestRef.current;
        // 仅当当前内容不是示例文章时才填充，避免重复设置
        if (latest.markdown !== defaultMarkdown) {
          setMarkdown(defaultMarkdown);
        }
      }
      return;
    }
    const candidateEntry =
      history.find((entry) => entry.id === activeId) ?? history[0];
    if (!candidateEntry) return;

    const latest = latestRef.current;
    const matchesLatest =
      latest.markdown === candidateEntry.markdown &&
      latest.theme === candidateEntry.theme &&
      latest.customCSS === candidateEntry.customCSS &&
      latest.themeName === candidateEntry.themeName;

    // 首次加载时，始终应用历史记录，确保刷新后恢复上次编辑的内容

    if (matchesLatest) {
      if (candidateEntry.id !== activeId) {
        setActiveId(candidateEntry.id);
      }
      hasAppliedInitialHistoryRef.current = true;
      return;
    }

    if (candidateEntry.id !== activeId) {
      setActiveId(candidateEntry.id);
    }

    isRestoringRef.current = true;
    restoringContentRef.current = candidateEntry.markdown; // Set expected content
    setMarkdown(candidateEntry.markdown);
    selectTheme(candidateEntry.theme); // 使用 selectTheme 替代 setTheme + setThemeName
    setCustomCSS(candidateEntry.customCSS);
    setFilePath(candidateEntry.filePath);
    if (candidateEntry.filePath) {
      const last = Math.max(
        candidateEntry.filePath.lastIndexOf("/"),
        candidateEntry.filePath.lastIndexOf("\\"),
      );
      if (last >= 0) {
        const dir = candidateEntry.filePath.slice(0, last);
        if (dir) {
          setWorkspaceDir(dir);
        }
      }
    }
    latestRef.current = {
      markdown: candidateEntry.markdown,
      theme: candidateEntry.theme,
      customCSS: candidateEntry.customCSS,
      themeName: candidateEntry.themeName,
    };
    hasUserEditedRef.current = false;
    isRestoringRef.current = false;
    hasAppliedInitialHistoryRef.current = true;
  }, [
    history,
    activeId,
    setActiveId,
    setMarkdown,
    selectTheme,
    setCustomCSS,
    setFilePath,
    setWorkspaceDir,
  ]);

  return null;
}
