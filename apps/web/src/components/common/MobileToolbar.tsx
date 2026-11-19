import {
  Pencil,
  Eye,
  Copy,
  MoreHorizontal,
  Palette,
  Code,
  FileDown,
  ImageDown,
  X,
} from "lucide-react";
import { useState } from "react";
import type { MobileViewType } from "../../hooks/useMobileView";
import "./MobileToolbar.css";

interface MobileToolbarProps {
  activeView: MobileViewType;
  onViewChange: (view: MobileViewType) => void;
  onCopyToWechat: () => void;
  onCopyAsHtml: () => void;
  onDownloadHtml: () => void;
  onExportLongImage: () => void;
  onOpenTheme: () => void;
}

/**
 * 移动端底部工具栏
 */
export function MobileToolbar({
  activeView,
  onViewChange,
  onCopyToWechat,
  onCopyAsHtml,
  onDownloadHtml,
  onExportLongImage,
  onOpenTheme,
}: MobileToolbarProps) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <>
      {/* 更多菜单弹窗 */}
      {showMenu && (
        <div className="mobile-menu-overlay" onClick={() => setShowMenu(false)}>
          <div
            className="mobile-menu-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mobile-menu-header">
              <span>更多功能</span>
              <button
                className="mobile-menu-close"
                onClick={() => setShowMenu(false)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="mobile-menu-list">
              <button
                className="mobile-menu-item"
                onClick={() => {
                  onCopyAsHtml();
                  setShowMenu(false);
                }}
              >
                <Code size={20} />
                <span>复制带样式 HTML</span>
              </button>
              <button
                className="mobile-menu-item"
                onClick={() => {
                  onDownloadHtml();
                  setShowMenu(false);
                }}
              >
                <FileDown size={20} />
                <span>下载 HTML 文件</span>
              </button>
              <button
                className="mobile-menu-item"
                onClick={() => {
                  onExportLongImage();
                  setShowMenu(false);
                }}
              >
                <ImageDown size={20} />
                <span>导出长图</span>
              </button>
              <button
                className="mobile-menu-item"
                onClick={() => {
                  onOpenTheme();
                  setShowMenu(false);
                }}
              >
                <Palette size={20} />
                <span>主题管理</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 底部工具栏 */}
      <div className="mobile-toolbar">
        <div className="mobile-toolbar-tabs">
          <button
            className={`mobile-tab ${activeView === "editor" ? "active" : ""}`}
            onClick={() => onViewChange("editor")}
          >
            <Pencil size={18} />
            <span>编辑</span>
          </button>
          <button
            className={`mobile-tab ${activeView === "preview" ? "active" : ""}`}
            onClick={() => onViewChange("preview")}
          >
            <Eye size={18} />
            <span>预览</span>
          </button>
        </div>

        <div className="mobile-toolbar-actions">
          <button
            className="mobile-action-btn primary"
            onClick={onCopyToWechat}
          >
            <Copy size={18} />
          </button>
          <button
            className="mobile-action-btn"
            onClick={() => setShowMenu(true)}
          >
            <MoreHorizontal size={18} />
          </button>
        </div>
      </div>
    </>
  );
}
