import type { CSSProperties } from "react";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Toaster } from "react-hot-toast";
import { Header } from "./components/Header/Header";
import { FileSidebar } from "./components/Sidebar/FileSidebar";
import { MarkdownEditor } from "./components/Editor/MarkdownEditor";
import { MarkdownPreview } from "./components/Preview/MarkdownPreview";
import { useFileSystem } from "./hooks/useFileSystem";
import { useMobileView } from "./hooks/useMobileView";
import { MobileToolbar } from "./components/common/MobileToolbar";
import { useEditorStore } from "./store/editorStore";
import "./styles/global.css";
import "./App.css";

import { useStorageContext } from "./storage/StorageContext";
import { Loader2 } from "lucide-react";
import { useHistoryStore } from "./store/historyStore";
import { useFileStore } from "./store/fileStore";
import { platform } from "./lib/platformAdapter";

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

interface UpdateEventData {
  latestVersion: string;
  currentVersion: string;
  releaseNotes?: string;
  force?: boolean;
}

interface ElectronUpdateAPI {
  onUpdateAvailable?: (callback: (data: UpdateEventData) => void) => () => void;
  onUpToDate?: (
    callback: (data: { currentVersion: string }) => void,
  ) => () => void;
  onUpdateError?: (callback: () => void) => () => void;
  removeUpdateListener?: (handler: (() => void) | undefined) => void;
  openReleases?: () => void;
}

function App() {
  const { workspacePath, saveFile } = useFileSystem();
  const { type: storageType, ready } = useStorageContext();
  const historyLoading = useHistoryStore((state) => state.loading);
  const fileLoading = useFileStore((state) => state.isLoading);
  const {
    isMobile: isMobileScreen,
    activeView,
    setActiveView,
  } = useMobileView();
  const isMobile = isMobileScreen && !platform.isElectron;
  const copyToWechat = useEditorStore((state) => state.copyToWechat);
  const [showThemePanel, setShowThemePanel] = useState(false);

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

  const isElectron = platform.isElectron;

  // 更新提示状态
  const [updateInfo, setUpdateInfo] = useState<{
    latestVersion: string;
    currentVersion: string;
    releaseNotes: string;
  } | null>(null);

  // 监听 Electron 更新事件
  useEffect(() => {
    if (!isElectron) return;
    const electron = window.electron as { update?: ElectronUpdateAPI };
    if (!electron?.update?.onUpdateAvailable) return;

    const availableHandler = electron.update.onUpdateAvailable(
      (data: UpdateEventData) => {
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
      },
    );

    const upToDateHandler = electron.update.onUpToDate?.(
      (data: { currentVersion: string }) => {
        // 使用 react-hot-toast 显示已是最新版本
        import("react-hot-toast").then(({ default: toast }) => {
          toast.success(`当前已是最新版本 (${data.currentVersion})`);
        });
      },
    );

    const errorHandler = electron.update.onUpdateError?.(() => {
      import("react-hot-toast").then(({ default: toast }) => {
        toast.error("检查更新失败，请稍后重试");
      });
    });

    return () => {
      electron.update?.removeUpdateListener?.(availableHandler);
      if (upToDateHandler)
        electron.update?.removeUpdateListener?.(upToDateHandler);
      if (errorHandler) electron.update?.removeUpdateListener?.(errorHandler);
    };
  }, [isElectron]);

  const [showHistory, setShowHistory] = useState(() => {
    if (typeof window === "undefined") return true;
    const saved = localStorage.getItem("wemd-show-history");
    return saved !== "false";
  });
  const [historyWidth, setHistoryWidth] = useState<string>(
    showHistory ? "280px" : "0px",
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
      setHistoryWidth("280px");
      return;
    }
    const timer = window.setTimeout(() => setHistoryWidth("0px"), 350);
    return () => window.clearTimeout(timer);
  }, [showHistory]);

  const mainClass = "app-main";
  const mainStyle = useMemo(
    () =>
      ({
        "--history-width": historyWidth,
      }) as CSSProperties,
    [historyWidth],
  );

  // Electron 模式：强制选择工作区
  if (isElectron && !workspacePath) {
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
    <div className="app" data-layout-mode={isMobile ? "mobile" : "desktop"}>
      {/* 更新提示 Modal */}
      {updateInfo && (
        <Suspense fallback={null}>
          <UpdateModal
            latestVersion={updateInfo.latestVersion}
            currentVersion={updateInfo.currentVersion}
            releaseNotes={updateInfo.releaseNotes}
            onClose={() => setUpdateInfo(null)}
            onDownload={() => {
              (
                window.electron as { update?: ElectronUpdateAPI }
              )?.update?.openReleases?.();
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
      {/* 只在存储上下文完全就绪且确认为 IndexedDB 模式时才渲染 HistoryManager */}
      {!isElectron && ready && storageType === "indexeddb" && (
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
              borderRadius: "50px",
              padding: "10px 20px",
              fontSize: "14px",
              fontWeight: 500,
              border: "1px solid rgba(0, 0, 0, 0.05)",
              maxWidth: "400px",
            },
            success: {
              iconTheme: {
                primary: "#07c160",
                secondary: "#fff",
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
        <button
          className={`history-toggle ${showHistory ? "" : "is-collapsed"}`}
          onClick={() => setShowHistory((prev) => !prev)}
          aria-label={showHistory ? "隐藏列表" : "显示列表"}
        >
          <span className="sr-only">
            {showHistory ? "隐藏列表" : "显示列表"}
          </span>
        </button>
        <main
          className={mainClass}
          style={mainStyle}
          data-show-history={showHistory}
        >
          <div
            className={`history-pane ${showHistory ? "is-visible" : "is-hidden"}`}
            aria-hidden={!showHistory}
          >
            <div className="history-pane__content">
              {/* ready 后渲染，防止闪烁 */}
              {ready &&
                (isElectron || storageType === "filesystem" ? (
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
          <div
            className="workspace"
            data-mobile-view={isMobile ? activeView : undefined}
          >
            <div className="editor-pane">
              {/* 存储未就绪或文件/历史加载中显示 loading */}
              {!ready ||
              fileLoading ||
              (historyLoading && !isElectron && storageType === "indexeddb") ? (
                <div className="workspace-loading">
                  <Loader2 className="animate-spin" size={24} />
                  <p>正在加载文章</p>
                </div>
              ) : (
                <MarkdownEditor />
              )}
            </div>
            <div className="preview-pane">
              {!ready ||
              fileLoading ||
              (historyLoading && !isElectron && storageType === "indexeddb") ? (
                <div className="workspace-loading">
                  <Loader2 className="animate-spin" size={24} />
                  <p>正在加载文章</p>
                </div>
              ) : (
                <MarkdownPreview />
              )}
            </div>
          </div>

          {/* 移动端底部工具栏 */}
          {isMobile && (
            <MobileToolbar
              activeView={activeView}
              onViewChange={setActiveView}
              onCopyToWechat={copyToWechat}
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
