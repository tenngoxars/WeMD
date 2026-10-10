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
const AiSettings = lazy(() =>
  import("../Settings/AiSettings").then((m) => ({
    default: m.AiSettings,
  })),
);
import {
  Layers,
  Palette,
  Send,
  Code,
  ImageIcon,
  ImageUp,
  Sun,
  Moon,
  ChevronsUp,
  ChevronsDown,
} from "lucide-react";
import { useUITheme } from "../../hooks/useUITheme";
import { useWindowControls } from "../../hooks/useWindowControls";
import { useLocalImageUpload } from "../../hooks/useLocalImageUpload";
import { resolveAppAssetPath } from "../../utils/assetPath";
import { Modal, FloatingToolbarButton, WindowControls } from "../common";
import { AI_SETTINGS_OPEN_EVENT } from "../../services/ai/aiConfig";

export function Header() {
  const { copyToWechat, copyAsHtml } = useEditorStore();
  const [showThemePanel, setShowThemePanel] = useState(false);
  const [showStorageModal, setShowStorageModal] = useState(false);
  const [showImageHostModal, setShowImageHostModal] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  useEffect(() => {
    const open = () => setShowAiModal(true);
    window.addEventListener(AI_SETTINGS_OPEN_EVENT, open);
    return () => window.removeEventListener(AI_SETTINGS_OPEN_EVENT, open);
  }, []);

  const uiTheme = useUITheme((state) => state.theme);
  const setTheme = useUITheme((state) => state.setTheme);
  const { isElectron, isWindows, platform } = useWindowControls();
  const {
    isElectronEnv,
    canUploadLocalImages,
    uploadingLocalImages,
    uploadLocalImages,
  } = useLocalImageUpload();
  const localImageUploadTitle = canUploadLocalImages
    ? "一键上传文档中的本地图片到图床，并替换为在线链接"
    : "打开一个本地 Markdown 文件后，可批量上传其中的本地图片";
  const logoSrc = resolveAppAssetPath(
    uiTheme === "dark" ? "favicon-light.svg" : "favicon-dark.svg",
  );

  // 自动隐藏标题栏状态
  const [autoHide, setAutoHide] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem("wemd-header-autohide") === "true";
    } catch {
      return false;
    }
  });

  // 保存状态到 localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("wemd-header-autohide", String(autoHide));
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
    platform === "darwin" ? { paddingLeft: "80px" } : undefined;

  return (
    <>
      {/* 隐藏状态下的浮动工具栏 */}
      {autoHide && (
        <div
          className={`floating-toolbar ${isWindows ? "floating-toolbar-win" : ""}`}
        >
          <FloatingToolbarButton
            icon={<ChevronsUp size={18} strokeWidth={2} />}
            label="显示标题栏"
            onClick={() => setAutoHide(false)}
            highlight
          />
          <FloatingToolbarButton
            icon={
              uiTheme === "dark" ? (
                <Sun size={18} strokeWidth={2} />
              ) : (
                <Moon size={18} strokeWidth={2} />
              )
            }
            label={uiTheme === "dark" ? "亮色模式" : "暗色模式"}
            onClick={() => setTheme(uiTheme === "dark" ? "default" : "dark")}
          />
          {!isElectron && (
            <FloatingToolbarButton
              icon={<Layers size={18} strokeWidth={2} />}
              label="存储模式"
              onClick={() => setShowStorageModal(true)}
            />
          )}
          <FloatingToolbarButton
            icon={<ImageIcon size={18} strokeWidth={2} />}
            label="图床设置"
            onClick={() => setShowImageHostModal(true)}
          />
          {canUploadLocalImages && (
            <FloatingToolbarButton
              icon={<ImageUp size={18} strokeWidth={2} />}
              label={uploadingLocalImages ? "上传中..." : "批量上传图片"}
              onClick={uploadLocalImages}
            />
          )}
          <FloatingToolbarButton
            icon={<Palette size={18} strokeWidth={2} />}
            label="主题管理"
            onClick={() => setShowThemePanel(true)}
          />
          <FloatingToolbarButton
            icon={<Code size={18} strokeWidth={2} />}
            label="复制 HTML"
            onClick={copyAsHtml}
          />
          <FloatingToolbarButton
            icon={<Send size={18} strokeWidth={2} />}
            label="复制到公众号"
            onClick={copyToWechat}
            primary
          />
        </div>
      )}

      {/* 隐藏标题栏由拖拽区与 Windows 窗控共同布局，避免两个命中区域重叠 */}
      {isElectron && (
        <div className={`hidden-titlebar ${autoHide ? "is-active" : ""}`}>
          <div className="hidden-titlebar-drag-region" aria-hidden="true" />
          {autoHide && isWindows && <WindowControls variant="compact" />}
        </div>
      )}

      <header
        className={`app-header ${autoHide ? "header-auto-hide" : ""}`}
        style={headerStyle}
      >
        <div className="header-left">
          <div className="logo" aria-label="WeMD 编辑器">
            <img className="logo-mark" src={logoSrc} alt="WeMD Logo" />
            <span className="logo-text">WeMD</span>
          </div>
          <span className="header-divider" aria-hidden="true" />
          <nav className="header-nav" aria-label="编辑器设置">
            {!isElectron && (
              <button
                className="header-nav-button"
                onClick={() => setShowStorageModal(true)}
              >
                存储模式
              </button>
            )}
            <button
              className="header-nav-button"
              onClick={() => setShowImageHostModal(true)}
            >
              图床设置
            </button>
            {isElectronEnv && (
              <button
                className="header-nav-button"
                onClick={uploadLocalImages}
                disabled={!canUploadLocalImages || uploadingLocalImages}
                title={localImageUploadTitle}
              >
                {uploadingLocalImages ? "上传中..." : "批量上传图片"}
              </button>
            )}
            <button
              className="header-nav-button"
              onClick={() => setShowThemePanel(true)}
            >
              文章主题
            </button>
            <button
              className="header-nav-button"
              onClick={() => setShowAiModal(true)}
            >
              AI 优化
            </button>
          </nav>
        </div>

        <div className="header-actions">
          <div className="header-right">
            <button
              className="btn-icon-only header-theme-toggle"
              onClick={() => setTheme(uiTheme === "dark" ? "default" : "dark")}
              aria-label={
                uiTheme === "dark" ? "切换到亮色模式" : "切换到暗色模式"
              }
              data-tooltip={
                uiTheme === "dark" ? "切换到亮色模式" : "切换到暗色模式"
              }
            >
              {uiTheme === "dark" ? (
                <Sun size={18} strokeWidth={2} />
              ) : (
                <Moon size={18} strokeWidth={2} />
              )}
            </button>
            <button
              className="btn-secondary header-action-button header-action-secondary"
              onClick={copyAsHtml}
              aria-label="复制 HTML"
            >
              <Code size={18} strokeWidth={2} />
              <span>复制 HTML</span>
            </button>

            <button
              className="btn-primary header-action-button header-action-primary"
              onClick={copyToWechat}
              aria-label="复制到公众号"
            >
              <Send size={18} strokeWidth={2} />
              <span>复制到公众号</span>
            </button>

            <button
              className="btn-ghost"
              onClick={handleHideHeader}
              aria-label="隐藏标题栏"
              data-tooltip="隐藏标题栏"
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

      <Modal
        open={showStorageModal}
        onClose={() => setShowStorageModal(false)}
        title="存储模式"
        description="选择文章保存在浏览器中，或直接读写本地文件夹"
      >
        <Suspense
          fallback={
            <div style={{ padding: "20px", textAlign: "center" }}>
              loading...
            </div>
          }
        >
          <StorageModeSelector />
        </Suspense>
      </Modal>

      <Modal
        open={showAiModal}
        onClose={() => setShowAiModal(false)}
        title="AI 优化"
        description="配置模型后，在编辑器中选中文字即可润色、精简或改写"
      >
        <Suspense
          fallback={
            <div style={{ padding: "20px", textAlign: "center" }}>
              loading...
            </div>
          }
        >
          <AiSettings onClose={() => setShowAiModal(false)} />
        </Suspense>
      </Modal>

      <Modal
        open={showImageHostModal}
        onClose={() => setShowImageHostModal(false)}
        title="图床设置"
        description="选择上传服务并管理连接配置"
        className="modal-narrow image-host-modal"
      >
        <Suspense
          fallback={
            <div style={{ padding: "20px", textAlign: "center" }}>
              loading...
            </div>
          }
        >
          <ImageHostSettings />
        </Suspense>
      </Modal>
    </>
  );
}
