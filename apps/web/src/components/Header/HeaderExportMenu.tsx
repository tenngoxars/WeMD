import { useEffect, useRef, useState } from "react";
import { ChevronDown, Download, FileDown, ImageDown } from "lucide-react";

interface HeaderExportMenuProps {
  onDownloadHtml: () => void;
  onExportLongImage: () => void;
}

/** 顶栏「导出」下拉：只放文件导出，复制动作单独放顶栏按钮 */
export function HeaderExportMenu({
  onDownloadHtml,
  onExportLongImage,
}: HeaderExportMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div className="header-export-menu" ref={menuRef}>
      <button
        className="btn-secondary header-action-button header-action-secondary"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="导出"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Download size={18} strokeWidth={2} />
        <span>导出</span>
        <ChevronDown className="header-export-chevron" strokeWidth={2} />
      </button>
      {open && (
        <div className="header-export-dropdown" role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onDownloadHtml();
            }}
          >
            <FileDown size={16} strokeWidth={2} />
            下载 HTML 文件
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onExportLongImage();
            }}
          >
            <ImageDown size={16} strokeWidth={2} />
            导出长图
          </button>
        </div>
      )}
    </div>
  );
}
