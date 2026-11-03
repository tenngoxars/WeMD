import { useLayoutEffect, useState, type CSSProperties } from "react";
import { Loader2 } from "lucide-react";
import { MarkdownEditor } from "../Editor/MarkdownEditor";
import { AiScoreSidePanel } from "../Editor/AiOptimize/AiScoreSidePanel";
import { useAiPanelStore } from "../../store/aiPanelStore";
import { platform } from "../../lib/platformAdapter";
import { useFileStore } from "../../store/fileStore";
import { useHistoryStore } from "../../store/historyStore";

// 与 AiOptimize.css 的退场动画时长保持一致
const SCORE_PANEL_EXIT_MS = 180;
import { MarkdownPreview } from "../Preview/MarkdownPreview";
import { ResizeHandle } from "./ResizeHandle";
import { useEditorPreviewScrollSync } from "./useEditorPreviewScrollSync";
import { useSplitPane } from "./useSplitPane";
import "./EditorPreviewWorkspace.css";

interface EditorPreviewWorkspaceProps {
  loading: boolean;
  mobileView?: "editor" | "preview";
  onPreviewMinimumWidthChange?: (width: number) => void;
}

const Loading = () => (
  <div className="workspace-loading">
    <Loader2 className="animate-spin" size={24} />
    <p>正在加载文章</p>
  </div>
);

export function EditorPreviewWorkspace({
  loading,
  mobileView,
  onPreviewMinimumWidthChange,
}: EditorPreviewWorkspaceProps) {
  const { registerEditor, registerPreview } = useEditorPreviewScrollSync();
  const isMobileLayout = mobileView !== undefined;
  const {
    containerRef,
    previewPaneRef,
    previewContainerRef,
    minPreviewWidth,
    editorWidth,
    minWidth,
    maxWidth,
    keyboardStep,
    keyboardStepLarge,
    isDragging,
    setDragging,
    setWidth,
    setWidthFromClientX,
    resetWidth,
  } = useSplitPane({ enabled: !isMobileLayout });
  useLayoutEffect(() => {
    if (isMobileLayout) return;
    onPreviewMinimumWidthChange?.(minPreviewWidth);
  }, [isMobileLayout, minPreviewWidth, onPreviewMinimumWidthChange]);
  // 审阅侧栏占用预览栏位置：编辑器保持满宽，正文全程可见便于定位
  const scorePanelOpen = useAiPanelStore((state) => state.scorePanelOpen);
  const activeId = useHistoryStore((state) => state.activeId);
  const currentFile = useFileStore((state) => state.currentFile);
  const workspaceRevision = useFileStore((state) => state.workspaceRevision);
  const fileMode =
    platform.isDesktop || Boolean(currentFile) || workspaceRevision > 0;
  const articleKey = fileMode
    ? `file:${workspaceRevision}:${currentFile?.path ?? "draft"}`
    : `history:${activeId ?? "draft"}`;
  const [mountedArticleKey, setMountedArticleKey] = useState(articleKey);
  // 首次打开后常驻，关闭只隐藏：否则卸载会丢掉审阅结果并在重开时重跑
  const [everOpened, setEverOpened] = useState(false);
  // 只负责退场：关闭后仍要占位并播完动画，否则预览会从淡出的侧栏底下透出来
  const [exiting, setExiting] = useState(false);

  useLayoutEffect(() => {
    if (mountedArticleKey === articleKey) return;
    setMountedArticleKey(articleKey);
    setEverOpened(false);
    setExiting(false);
    useAiPanelStore.getState().closeScorePanel();
  }, [articleKey, mountedArticleKey]);

  const articleIsCurrent = mountedArticleKey === articleKey;
  const showScorePanel = scorePanelOpen && !isMobileLayout && articleIsCurrent;

  useLayoutEffect(() => {
    if (showScorePanel) {
      setEverOpened(true);
      setExiting(false);
      return;
    }
    if (!everOpened) return;
    setExiting(true);
    const timer = window.setTimeout(
      () => setExiting(false),
      SCORE_PANEL_EXIT_MS,
    );
    return () => window.clearTimeout(timer);
  }, [showScorePanel, everOpened]);

  // 都在 render 阶段直接由 showScorePanel 推导：放到 effect 里算会晚一帧，
  // 那一帧预览还占着列，打开时就会闪一下
  const scorePanelMounted = articleIsCurrent && (showScorePanel || everOpened);
  const panelOccupiesColumn = showScorePanel || exiting;

  const style = isMobileLayout
    ? undefined
    : ({
        "--editor-pane-width": `${editorWidth}px`,
      } as CSSProperties);

  return (
    <div
      ref={containerRef}
      className={`workspace ${isDragging ? "is-resizing" : ""}`}
      style={style}
      data-mobile-view={mobileView}
    >
      <div className="editor-pane">
        {loading ? (
          <Loading />
        ) : (
          <MarkdownEditor onScrollSyncReady={registerEditor} />
        )}
      </div>
      {!isMobileLayout && (
        <ResizeHandle
          width={editorWidth}
          minWidth={minWidth}
          maxWidth={maxWidth}
          step={keyboardStep}
          stepLarge={keyboardStepLarge}
          onWidthChange={setWidth}
          onPointerPosition={setWidthFromClientX}
          onReset={resetWidth}
          onDraggingChange={setDragging}
        />
      )}
      <div
        ref={previewPaneRef}
        className="preview-pane"
        hidden={panelOccupiesColumn}
      >
        {loading ? (
          <Loading />
        ) : (
          <MarkdownPreview
            onScrollSyncReady={registerPreview}
            onScrollContainerChange={previewContainerRef}
          />
        )}
      </div>
      {scorePanelMounted && (
        <AiScoreSidePanel
          key={articleKey}
          hidden={!panelOccupiesColumn}
          closing={exiting && !showScorePanel}
        />
      )}
    </div>
  );
}
