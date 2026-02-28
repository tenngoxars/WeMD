import { Globe, BookOpen } from "lucide-react";
import { useUITheme } from "../../hooks/useUITheme";
import { resolveAppAssetPath } from "../../utils/assetPath";
import "./SidebarFooter.css";

const GithubIcon = ({ size = 24 }: { size?: number | string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

export function SidebarFooter() {
  const uiTheme = useUITheme((state) => state.theme);
  const logoSrc = resolveAppAssetPath(
    uiTheme === "dark" ? "favicon-light.svg" : "favicon-dark.svg",
  );

  return (
    <div className="sidebar-footer">
      <div className="footer-brand">
        <div className="footer-logo">
          <img src={logoSrc} alt="Logo" />
        </div>
        <div className="footer-info">
          <span className="footer-name">WeMD</span>
          <span className="footer-version">v{__APP_VERSION__}</span>
        </div>
      </div>
      <div className="footer-links">
        <a
          href="https://github.com/tenngoxars/WeMD"
          target="_blank"
          rel="noopener noreferrer"
          data-tooltip="GitHub 仓库"
          aria-label="GitHub 仓库"
        >
          <GithubIcon size={16} />
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
  );
}
