import type { CSSProperties } from "react";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Toaster } from "react-hot-toast";
import { Header } from "./components/Header/Header";
import { FileSidebar } from "./components/Sidebar/FileSidebar";
import { EditorPreviewWorkspace } from "./components/Workspace/EditorPreviewWorkspace";
import {
  DEFAULT_MIN_PREVIEW_WIDTH,
  getDesktopAppMinWidth,
} from "./components/Workspace/useSplitPane";
import { useFileSystem } from "./hooks/useFileSystem";
import { useMobileView } from "./hooks/useMobileView";
import { MobileToolbar } from "./components/common/MobileToolbar";
import { useEditorStore } from "./store/editorStore";
import "./styles/global.css";
import "./App.css";

import { useStorageContext } from "./storage/StorageContext";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useHistoryStore } from "./store/historyStore";
import { useFileStore } from "./store/fileStore";
import { getDesktop, platform } from "./lib/platformAdapter";

const HistoryPanel = lazy(() =>
  import("./components/History/HistoryPanel").then((m) => ({
    default: m.HistoryPanel,
  })),
);
const HistoryManager = lazy(() =>
  import("./components/History/HistoryManager").then((m) => ({
    default: m.HistoryManager,
  })),
);
const Welcome = lazy(() =>
  import("./components/Welcome/Welcome").then((m) => ({ default: m.Welcome })),
);
const UpdateModal = lazy(() =>
  import("./components/UpdateModal/UpdateModal").then((m) => ({
    default: m.UpdateModal,
  })),
);
import { MobileThemeSelector } from "./components/Theme/MobileThemeSelector";
import { WorkspaceThemeMergePrompt } from "./components/Theme/WorkspaceThemeMergePrompt";
import { useThemeStore } from "./store/themeStore";
import { createWorkspaceThemeBackend } from "./services/theme/themeStorageBackend";

function App() {
  const { workspacePath, saveFile } = useFileSystem({ enableEffects: true });
  const { adapter, type: storageType, ready } = useStorageContext();
  const historyLoading = useHistoryStore((state) => state.loading);
  const fileLoading = useFileStore((state) => state.isLoading);
  const workspaceRevision = useFileStore((state) => state.workspaceRevision);
  const {
    isMobile: isMobileScreen,
    activeView,
    setActiveView,
  } = useMobileView();
  const isMobile = isMobileScreen && !platform.isDesktop;
  const copyToWechat = useEditorStore((state) => state.copyToWechat);
  const copyAsHtml = useEditorStore((state) => state.copyAsHtml);
  const exportLongImage = useEditorStore((state) => state.exportLongImage);
  const [showThemePanel, setShowThemePanel] = useState(false);

  // 自定义主题真源在工作区文件夹，副作用单点启用
  useEffect(() => {
    const backend = createWorkspaceThemeBackend({
      storageType,
      storageReady: ready,
      adapter,
      workspacePath,
    });
    const themeStore = useThemeStore.getState();
    themeStore.setWorkspaceThemeBackend(backend);
    if (backend) void themeStore.loadWorkspaceThemes();
  }, [adapter, ready, storageType, workspacePath, workspaceRevision]);

  // 全局保存快捷键（统一监听器）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        saveFile(true); // showToast = true
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [saveFile]);

  const isDesktop = platform.isDesktop;
  // 桌面版文件走原生层，不依赖浏览器存储；不能等它就绪，否则 IndexedDB 打不开时界面永远停在加载中
  const storageSettled = isDesktop || ready;

  // 更新提示状态
  const [updateInfo, setUpdateInfo] = useState<{
    latestVersion: string;
    currentVersion: string;
    releaseNotes: string;
  } | null>(null);

  // 监听桌面端更新事件
  useEffect(() => {
    if (!isDesktop) return;
    const update = getDesktop()?.update;
    if (!update?.onUpdateAvailable) return;

    const availableHandler = update.onUpdateAvailable((data) => {
      // 检查是否跳过了此版本（除非是强制检查）
      const skippedVersion = localStorage.getItem("wemd-skipped-version");
      if (!data.force && skippedVersion === data.latestVersion) {
        return; // 用户之前选择跳过此版本
      }

      setUpdateInfo({
        latestVersion: data.latestVersion,
        currentVersion: data.currentVersion,
        releaseNotes: data.releaseNotes || "",
      });
    });

    const upToDateHandler = update.onUpToDate?.(
      (data: { currentVersion: string }) => {
        // 使用 react-hot-toast 显示已是最新版本
        import("react-hot-toast").then(({ default: toast }) => {
          toast.success(`当前已是最新版本 (${data.currentVersion})`);
        });
      },
    );

    const errorHandler = update.onUpdateError?.(() => {
      import("react-hot-toast").then(({ default: toast }) => {
        toast.error("检查更新失败，请稍后重试");
      });
    });

    return () => {
      update.removeUpdateListener?.(availableHandler);
      if (upToDateHandler) update.removeUpdateListener?.(upToDateHandler);
      if (errorHandler) update.removeUpdateListener?.(errorHandler);
    };
  }, [isDesktop]);

  const [showHistory, setShowHistory] = useState(() => {
    if (typeof window === "undefined") return true;
    const saved = localStorage.getItem("wemd-show-history");
    return saved !== "false";
  });
  const [historyWidth, setHistoryWidth] = useState<string>(
    showHistory ? "256px" : "0px",
  );

  useEffect(() => {
    try {
      localStorage.setItem("wemd-show-history", String(showHistory));
    } catch {
      /* 忽略持久化错误 */
    }
  }, [showHistory]);

  useEffect(() => {
    if (showHistory) {
      setHistoryWidth("256px");
      return;
    }
    const timer = window.setTimeout(() => setHistoryWidth("0px"), 350);
    return () => window.clearTimeout(timer);
  }, [showHistory]);

  const handleHistoryToggle = () => {
    if (!showHistory) setHistoryWidth("256px");
    setShowHistory((visible) => !visible);
  };

  const mainClass = "app-main";
  const [desktopPreviewMinWidth, setDesktopPreviewMinWidth] = useState(
    DEFAULT_MIN_PREVIEW_WIDTH,
  );
  const appStyle = useMemo<CSSProperties | undefined>(
    () =>
      isMobile
        ? undefined
        : { minWidth: `${getDesktopAppMinWidth(desktopPreviewMinWidth)}px` },
    [desktopPreviewMinWidth, isMobile],
  );
  const mainStyle = useMemo(
    () =>
      ({
        "--history-width": historyWidth,
      }) as CSSProperties,
    [historyWidth],
  );

  // 桌面端：强制选择工作区
  if (isDesktop && !workspacePath) {
    return (
      <>
        <Toaster position="top-center" />
        <Suspense
          fallback={
            <div className="workspace-loading">
              <Loader2 className="animate-spin" size={24} />
            </div>
          }
        >
          <Welcome />
        </Suspense>
      </>
    );
  }

  return (
    <div
      className="app"
      data-layout-mode={isMobile ? "mobile" : "desktop"}
      style={appStyle}
    >
      {/* 更新提示 Modal */}
      {updateInfo && (
        <Suspense fallback={null}>
          <UpdateModal
            latestVersion={updateInfo.latestVersion}
            currentVersion={updateInfo.currentVersion}
            releaseNotes={updateInfo.releaseNotes}
            onClose={() => setUpdateInfo(null)}
            onDownload={() => {
              getDesktop()?.update?.openReleases?.();
              setUpdateInfo(null);
            }}
            onSkipVersion={() => {
              localStorage.setItem(
                "wemd-skipped-version",
                updateInfo.latestVersion,
              );
              setUpdateInfo(null);
            }}
          />
        </Suspense>
      )}
      <WorkspaceThemeMergePrompt />

      {/* 只在存储上下文完全就绪且确认为 IndexedDB 模式时才渲染 HistoryManager */}
      {!isDesktop && ready && storageType === "indexeddb" && (
        <Suspense fallback={null}>
          <HistoryManager />
        </Suspense>
      )}

      <>
        <Toaster
          position="top-center"
          toastOptions={{
            className: "premium-toast",
            style: {
              background: "rgba(255, 255, 255, 0.9)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              color: "#1a1a1a",
              boxShadow: "0 12px 30px -10px rgba(0, 0, 0, 0.12)",
              borderRadius: "10px",
              padding: "10px 20px",
              fontSize: "14px",
              fontWeight: 500,
              border: "1px solid rgba(0, 0, 0, 0.05)",
              maxWidth: "400px",
            },
            success: {
              iconTheme: {
                primary: "var(--accent-primary)",
                secondary: "var(--on-accent)",
              },
              duration: 2000,
            },
            error: {
              iconTheme: {
                primary: "#ef4444",
                secondary: "#fff",
              },
              duration: 3000,
            },
          }}
        />
        <Header />
        <main
          className={mainClass}
          style={mainStyle}
          data-show-history={showHistory}
        >
          <button
            className={`history-toggle ${showHistory ? "" : "is-collapsed"}`}
            onClick={handleHistoryToggle}
            aria-label={showHistory ? "隐藏文件栏" : "显示文件栏"}
            title={showHistory ? "隐藏文件栏" : "显示文件栏"}
          >
            {showHistory ? (
              <ChevronLeft size={16} />
            ) : (
              <ChevronRight size={16} />
            )}
          </button>
          <div
            className={`history-pane ${showHistory ? "is-visible" : "is-hidden"}`}
            aria-hidden={!showHistory}
          >
            <div className="history-pane__content">
              {/* 存储就绪后渲染，防止闪烁 */}
              {storageSettled &&
                (isDesktop || storageType === "filesystem" ? (
                  <FileSidebar />
                ) : (
                  <Suspense
                    fallback={
                      <div className="workspace-loading">
                        <Loader2 className="animate-spin" size={24} />
                      </div>
                    }
                  >
                    <HistoryPanel />
                  </Suspense>
                ))}
            </div>
          </div>
          <EditorPreviewWorkspace
            loading={
              !storageSettled ||
              fileLoading ||
              (historyLoading && !isDesktop && storageType === "indexeddb")
            }
            mobileView={isMobile ? activeView : undefined}
            onPreviewMinimumWidthChange={setDesktopPreviewMinWidth}
          />

          {/* 移动端底部工具栏 */}
          {isMobile && (
            <MobileToolbar
              activeView={activeView}
              onViewChange={setActiveView}
              onCopyToWechat={copyToWechat}
              onCopyAsHtml={copyAsHtml}
              onExportLongImage={exportLongImage}
              onOpenTheme={() => setShowThemePanel(true)}
            />
          )}
        </main>
      </>

      {/* 移动端主题选择器 */}
      {isMobile && (
        <MobileThemeSelector
          open={showThemePanel}
          onClose={() => setShowThemePanel(false)}
        />
      )}
    </div>
  );
}

export default App;
