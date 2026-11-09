import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Lightbulb, ScanText } from "lucide-react";
import toast from "react-hot-toast";

import {
  isAiRewriteReady,
  subscribeAiConfig,
} from "../../../services/ai/aiConfig";
import { useFileSystem } from "../../../hooks/useFileSystem";
import { platform } from "../../../lib/platformAdapter";
import { useStorageContext } from "../../../storage/StorageContext";
import { useAiPanelStore } from "../../../store/aiPanelStore";
import { useEditorStore } from "../../../store/editorStore";
import { useHistoryStore } from "../../../store/historyStore";
import { useThemeStore } from "../../../store/themeStore";
import { useActiveArticleKey } from "../../../hooks/useActiveArticleKey";
import { AiTitlePanel } from "./AiTitlePanel";
import "./AiOptimize.css";
import {
  computeFloatingPanelBox,
  type FloatingPanelBox,
} from "../floatingPanelBox";

type PanelId = "title";

export function AiOptimizeButtons() {
  const markdown = useEditorStore((state) => state.markdown);
  const history = useHistoryStore((state) => state.history);
  const activeId = useHistoryStore((state) => state.activeId);
  const updateTitle = useHistoryStore((state) => state.updateTitle);
  const saveSnapshot = useHistoryStore((state) => state.saveSnapshot);
  // 文件模式下侧栏是 FileSidebar，标题存在文件的 frontmatter 里，与 historyStore 无关
  const { type: storageType } = useStorageContext();
  const isFileMode = platform.isDesktop || storageType === "filesystem";
  const { currentFile, files, flattenFiles, updateFileTitle } = useFileSystem();
  const articleKey = useActiveArticleKey();
  const currentTitle = isFileMode
    ? (currentFile?.title ?? "")
    : (history.find((entry) => entry.id === activeId)?.title ?? "");
  const [ready, setReady] = useState(() => isAiRewriteReady());
  const [open, setOpen] = useState<PanelId | null>(null);
  const [titleRunId, setTitleRunId] = useState(0);
  const [titleRunMarkdown, setTitleRunMarkdown] = useState(markdown);
  const [mounted, setMounted] = useState<Record<PanelId, boolean>>({
    title: false,
  });
  const [mountedArticleKey, setMountedArticleKey] = useState(articleKey);
  const scorePanelOpen = useAiPanelStore((state) => state.scorePanelOpen);
  const toggleScorePanel = useAiPanelStore((state) => state.toggleScorePanel);
  const closeScorePanel = useAiPanelStore((state) => state.closeScorePanel);
  const containerRef = useRef<HTMLDivElement>(null);
  const titleAnchorRef = useRef<HTMLButtonElement>(null);
  const titlePanelRef = useRef<HTMLDivElement>(null);
  const [titlePanelBox, setTitlePanelBox] = useState<FloatingPanelBox | null>(
    null,
  );

  useEffect(() => subscribeAiConfig(() => setReady(isAiRewriteReady())), []);

  useEffect(() => {
    if (mountedArticleKey === articleKey) return;
    setMountedArticleKey(articleKey);
    setMounted({ title: false });
    setOpen(null);
    closeScorePanel();
  }, [articleKey, closeScorePanel, mountedArticleKey]);

  const closeTitle = () => {
    setOpen(null);
  };

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !containerRef.current?.contains(target) &&
        !titlePanelRef.current?.contains(target)
      ) {
        closeTitle();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeTitle();
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (open !== "title") {
      if (!mounted.title) setTitlePanelBox(null);
      return;
    }

    const measure = () => {
      const anchor = titleAnchorRef.current?.getBoundingClientRect();
      if (!anchor) return;
      setTitlePanelBox(
        computeFloatingPanelBox(
          anchor,
          { width: window.innerWidth, height: window.innerHeight },
          {
            width: 380,
            preferredMaxHeight: window.innerHeight * 0.6,
            margin: 8,
            gap: 4,
          },
        ),
      );
    };

    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measure);
    if (titleAnchorRef.current) observer?.observe(titleAnchorRef.current);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, mounted.title]);

  const toggle = (id: PanelId) => {
    if (open === id) {
      closeTitle();
      return;
    }

    const needsNewRun = !mounted[id] || titleRunMarkdown !== markdown;
    if (needsNewRun) {
      setTitleRunMarkdown(markdown);
      setTitleRunId((runId) => runId + 1);
    }
    setMounted((prev) => (prev[id] ? prev : { ...prev, [id]: true }));
    setOpen(id);
    // 两个同时跑会在服务商侧互相排队，等待时间翻倍
    if (scorePanelOpen) closeScorePanel();
  };

  // 两种存储模式的文章列表读的不是同一处标题，必须分别写回
  const handleReplaceTitle = async (title: string) => {
    closeTitle();

    if (isFileMode) {
      const target = flattenFiles(files).find(
        (file) => file.path === currentFile?.path,
      );
      if (!target) {
        toast.error("请先打开或新建一个文件");
        return;
      }
      // 同时改写 frontmatter 标题与文件名，并刷新侧栏
      await updateFileTitle(target, title);
      return;
    }

    if (activeId) {
      await updateTitle(activeId, title);
      toast.success("已设置文章标题");
      return;
    }

    // 新文章还没落盘就没有条目，直接带标题存一份——给新文章起名正是主要用法
    const themeStore = useThemeStore.getState();
    const saved = await saveSnapshot({
      markdown,
      title,
      theme: themeStore.themeId,
      themeName: themeStore.themeName,
      customCSS: themeStore.customCSS,
    });
    toast[saved ? "success" : "error"](
      saved ? "已设置文章标题" : "标题设置失败，请先写点内容再试",
    );
  };

  const tooltip = (label: string) =>
    ready ? label : `${label}：请先配置 AI 设置`;

  return (
    <div
      className="md-toolbar-dropdown-container ai-optimize-group"
      ref={containerRef}
    >
      <button
        className={`md-toolbar-btn ${scorePanelOpen ? "active" : ""}`}
        disabled={!ready}
        aria-label={tooltip("全文审阅")}
        data-tooltip={tooltip("全文审阅")}
        onClick={() => {
          closeTitle();
          toggleScorePanel();
        }}
      >
        <ScanText size={16} />
      </button>

      <button
        ref={titleAnchorRef}
        className={`md-toolbar-btn ${open === "title" ? "active" : ""}`}
        disabled={!ready}
        aria-label={tooltip("起标题")}
        data-tooltip={tooltip("起标题")}
        onClick={() => toggle("title")}
      >
        <Lightbulb size={16} />
      </button>

      {mountedArticleKey === articleKey &&
        mounted.title &&
        titlePanelBox &&
        createPortal(
          <div
            ref={titlePanelRef}
            className="ai-title-floating-panel"
            data-toolbar-floating-panel
            style={{
              position: "fixed",
              zIndex: 1000,
              left: titlePanelBox.left,
              top: titlePanelBox.top,
              width: titlePanelBox.width,
              maxHeight: titlePanelBox.maxHeight,
              display: open === "title" ? undefined : "none",
            }}
          >
            <AiTitlePanel
              key={`${articleKey}:${titleRunId}`}
              onRerun={() => {
                setTitleRunMarkdown(markdown);
                setTitleRunId((runId) => runId + 1);
              }}
              markdown={titleRunMarkdown}
              currentTitle={currentTitle}
              onClose={closeTitle}
              onReplaceTitle={(title) => void handleReplaceTitle(title)}
            />
          </div>,
          document.body,
        )}
    </div>
  );
}
