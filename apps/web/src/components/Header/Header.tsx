import { useState, useEffect, lazy, Suspense } from "react";
import { useEditorStore } from "../../store/editorStore";
import "./Header.css";

const ThemePanel = lazy(() =>
  import("../Theme/ThemePanel").then((m) => ({ default: m.ThemePanel })),
);
const StorageModeSelector = lazy(() =>
  import("../StorageModeSelector/StorageModeSelector").then((m) => ({
    default: m.StorageModeSelector,
  })),
);
const ImageHostSettings = lazy(() =>
  import("../Settings/ImageHostSettings").then((m) => ({
    default: m.ImageHostSettings,
  })),
);
import {
  Layers,
  Palette,
  Send,
  ImageIcon,
  Sun,
  Moon,
  ChevronsUp,
  ChevronsDown,
} from "lucide-react";
import { useUITheme } from "../../hooks/useUITheme";
import { useWindowControls } from "../../hooks/useWindowControls";

const DefaultLogoMark = () => (
  <svg
    width="40"
    height="40"
    viewBox="0 0 200 200"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M40 20 H160 C171 20 180 29 180 40 V140 C180 151 171 160 160 160 H140 L140 185 L110 160 H40 C29 160 20 151 20 140 V40 C20 29 29 20 40 20 Z"
      fill="#1A1A1A"
    />
    <rect x="50" y="50" width="100" height="12" rx="6" fill="#07C160" />
    <path
      d="M60 85 L60 130 H80 L80 110 L100 130 L120 110 L120 130 H140 L140 85 L120 85 L100 105 L80 85 Z"
      fill="#FFFFFF"
    />
  </svg>
);

const structuralismLogoSrc = `${import.meta.env.BASE_URL}favicon-light.svg`;

const StructuralismLogoMark = () => (
  <img
    src={structuralismLogoSrc}
    alt="WeMD Logo"
    width={40}
    height={40}
    style={{ display: "block" }}
  />
);

// 独立组件：窗口控制按钮
const WindowControls = ({ fixed = false }: { fixed?: boolean }) => {
  const { minimize, maximize, close } = useWindowControls();

  return (
    <div className={fixed ? "window-controls-fixed" : "window-controls"}>
      <button
        className="win-btn win-minimize"
        onClick={() => minimize?.()}
        aria-label="最小化"
      >
        <svg width="10" height="1" viewBox="0 0 10 1">
          <rect width="10" height="1" fill="currentColor" />
        </svg>
      </button>
      <button
        className="win-btn win-maximize"
        onClick={() => maximize?.()}
        aria-label="最大化"
      >
        <svg width="10" height="10" viewBox="0 0 10 10">
          <rect
            width="9"
            height="9"
            x="0.5"
            y="0.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
          />
        </svg>
      </button>
      <button
        className="win-btn win-close"
        onClick={() => close?.()}
        aria-label="关闭"
      >
        <svg width="10" height="10" viewBox="0 0 10 10">
          <path
            d="M0,0 L10,10 M10,0 L0,10"
            stroke="currentColor"
            strokeWidth="1.2"
          />
        </svg>
      </button>
    </div>
  );
};

export function Header() {
  const { copyToWechat } = useEditorStore();
  const [showThemePanel, setShowThemePanel] = useState(false);
  const [showStorageModal, setShowStorageModal] = useState(false);
  const [showImageHostModal, setShowImageHostModal] = useState(false);
  const uiTheme = useUITheme((state) => state.theme);
  const setTheme = useUITheme((state) => state.setTheme);
  const isStructuralismUI = uiTheme === "dark";

  const { isElectron, isWindows, platform } = useWindowControls();

  // 自动隐藏标题栏状态
  const [autoHide, setAutoHide] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem("wemd-header-autohide") === "true";
    } catch {
      return false;
    }
  });

  // 保存状态到 localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem("wemd-header-autohide", String(autoHide));
    } catch {
      // 忽略存储不可用的场景（如隐私模式）
    }
  }, [autoHide]);

  // 切换标题栏显示/隐藏
  const handleHideHeader = () => {
    setAutoHide(true);
  };

  // Mac 平台使用内联样式强制避让
  const headerStyle =
    platform === "darwin" ? { paddingLeft: "100px" } : undefined;

  return (
    <>
      {/* 隐藏状态下的持久化窗口控制 (Windows only) */}
      {autoHide && isWindows && <WindowControls fixed />}

      {/* 隐藏状态下的浮动工具栏 */}
      {autoHide && (
        <div
          className={`floating-toolbar ${isWindows ? "floating-toolbar-win" : ""}`}
        >
          <button
            className="floating-btn floating-btn-show"
            onClick={() => setAutoHide(false)}
            aria-label="显示标题栏"
            title="显示标题栏"
            data-tooltip="显示标题栏"
          >
            <ChevronsUp size={18} strokeWidth={2} />
          </button>

          <button
            className="floating-btn"
            onClick={() => setTheme(uiTheme === "dark" ? "default" : "dark")}
            aria-label={uiTheme === "dark" ? "亮色模式" : "暗色模式"}
            title={uiTheme === "dark" ? "亮色模式" : "暗色模式"}
            data-tooltip={uiTheme === "dark" ? "亮色模式" : "暗色模式"}
          >
            {uiTheme === "dark" ? (
              <Sun size={18} strokeWidth={2} />
            ) : (
              <Moon size={18} strokeWidth={2} />
            )}
          </button>

          {!isElectron && (
            <button
              className="floating-btn"
              onClick={() => setShowStorageModal(true)}
              aria-label="存储模式"
              title="存储模式"
              data-tooltip="存储模式"
            >
              <Layers size={18} strokeWidth={2} />
            </button>
          )}

          <button
            className="floating-btn"
            onClick={() => setShowImageHostModal(true)}
            aria-label="图床设置"
            title="图床设置"
            data-tooltip="图床设置"
          >
            <ImageIcon size={18} strokeWidth={2} />
          </button>

          <button
            className="floating-btn"
            onClick={() => setShowThemePanel(true)}
            aria-label="主题管理"
            title="主题管理"
            data-tooltip="主题管理"
          >
            <Palette size={18} strokeWidth={2} />
          </button>

          <button
            className="floating-btn floating-btn-primary"
            onClick={copyToWechat}
            aria-label="复制到公众号"
            title="复制到公众号"
            data-tooltip="复制到公众号"
          >
            <Send size={18} strokeWidth={2} />
          </button>
        </div>
      )}

      <header
        className={`app-header ${autoHide ? "header-auto-hide" : ""}`}
        style={headerStyle}
      >
        <div className="header-left">
          <div className="logo">
            {isStructuralismUI ? (
              <StructuralismLogoMark />
            ) : (
              <DefaultLogoMark />
            )}
            <div className="logo-info">
              <span className="logo-text">WeMD</span>
              <span className="logo-subtitle">公众号 Markdown 排版编辑器</span>
            </div>
          </div>
        </div>

        <div className="header-actions">
          <div className="header-right">
            <button
              className="btn-icon-only"
              onClick={() => setTheme(uiTheme === "dark" ? "default" : "dark")}
              aria-label={
                uiTheme === "dark" ? "切换到亮色模式" : "切换到暗色模式"
              }
              title={uiTheme === "dark" ? "切换到亮色模式" : "切换到暗色模式"}
            >
              {uiTheme === "dark" ? (
                <Sun size={18} strokeWidth={2} />
              ) : (
                <Moon size={18} strokeWidth={2} />
              )}
            </button>
            {!isElectron && (
              <button
                className="btn-secondary"
                onClick={() => setShowStorageModal(true)}
              >
                <Layers size={18} strokeWidth={2} />
                <span>存储模式</span>
              </button>
            )}
            <button
              className="btn-secondary"
              onClick={() => setShowImageHostModal(true)}
            >
              <ImageIcon size={18} strokeWidth={2} />
              <span>图床设置</span>
            </button>
            <button
              className="btn-secondary"
              onClick={() => setShowThemePanel(true)}
            >
              <Palette size={18} strokeWidth={2} />
              <span>主题管理</span>
            </button>

            <button className="btn-primary" onClick={copyToWechat}>
              <Send size={18} strokeWidth={2} />
              <span>复制到公众号</span>
            </button>

            <button
              className="btn-ghost"
              onClick={handleHideHeader}
              aria-label="隐藏标题栏"
              title="隐藏标题栏"
            >
              <ChevronsDown size={18} strokeWidth={2} />
            </button>
          </div>

          {/* Windows 自定义标题栏按钮 */}
          {isWindows && <WindowControls />}
        </div>
      </header>

      <Suspense fallback={null}>
        <ThemePanel
          open={showThemePanel}
          onClose={() => setShowThemePanel(false)}
        />
      </Suspense>

      {showStorageModal && (
        <div
          className="storage-modal-overlay"
          onClick={() => setShowStorageModal(false)}
        >
          <div
            className="storage-modal-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="storage-modal-header">
              <h3>选择存储模式</h3>
              <button
                className="storage-modal-close"
                onClick={() => setShowStorageModal(false)}
                aria-label="关闭"
              >
                ×
              </button>
            </div>
            <Suspense
              fallback={
                <div style={{ padding: "20px", textAlign: "center" }}>
                  loading...
                </div>
              }
            >
              <StorageModeSelector />
            </Suspense>
          </div>
        </div>
      )}

      {showImageHostModal && (
        <div
          className="storage-modal-overlay"
          onClick={() => setShowImageHostModal(false)}
        >
          <div
            className="storage-modal-panel image-host-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="storage-modal-header">
              <h3>图床设置</h3>
              <button
                className="storage-modal-close"
                onClick={() => setShowImageHostModal(false)}
                aria-label="关闭"
              >
                ×
              </button>
            </div>
            <Suspense
              fallback={
                <div style={{ padding: "20px", textAlign: "center" }}>
                  loading...
                </div>
              }
            >
              <ImageHostSettings />
            </Suspense>
          </div>
        </div>
      )}
    </>
  );
}
