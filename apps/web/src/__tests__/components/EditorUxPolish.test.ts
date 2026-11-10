/// <reference types="node" />

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const indexCss = readFileSync("src/index.css", "utf8");
const appCss = readFileSync("src/App.css", "utf8");
const appTsx = readFileSync("src/App.tsx", "utf8");
const appToasterTsx = readFileSync(
  "src/components/common/AppToaster.tsx",
  "utf8",
);
const appToasterCss = readFileSync(
  "src/components/common/AppToaster.css",
  "utf8",
);
const fileSidebarCss = readFileSync(
  "src/components/Sidebar/FileSidebar.css",
  "utf8",
);
const historyPanelCss = readFileSync(
  "src/components/History/HistoryPanel.css",
  "utf8",
);
const sidebarFooterCss = readFileSync(
  "src/components/Sidebar/SidebarFooter.css",
  "utf8",
);
const errorBoundaryCss = readFileSync(
  "src/components/ErrorBoundary/ErrorBoundary.css",
  "utf8",
);
const updateModalCss = readFileSync(
  "src/components/UpdateModal/UpdateModal.css",
  "utf8",
);

const relativeLuminance = (hex: string) => {
  const channels = hex
    .replace("#", "")
    .match(/.{2}/g)!
    .map((value) => Number.parseInt(value, 16) / 255)
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4),
    );

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

const contrastRatio = (foreground: string, background: string) => {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
};

describe("编辑器 UX 视觉校准", () => {
  it("亮色模式使用指定的深翡翠绿主色", () => {
    const lightTheme = indexCss.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1];

    expect(lightTheme).toContain("--ui-accent-primary: #047857;");
    expect(lightTheme).toContain("--ui-accent-hover: #006d3d;");
    expect(lightTheme).toContain("--ui-accent-active: #006d3d;");
    expect(lightTheme).toContain("--ui-on-accent: #ffffff;");
    expect(contrastRatio("#ffffff", "#047857")).toBeGreaterThanOrEqual(4.5);
  });

  it("暗色模式使用指定翡翠绿并保持按钮文字可读", () => {
    const darkTheme = indexCss.match(
      /\[data-ui-theme="dark"\]\s*\{([\s\S]*?)\n\}/,
    )?.[1];

    expect(darkTheme).toContain("--ui-accent-primary: #13a072;");
    expect(darkTheme).toContain("--ui-on-accent: #0b1f16;");
    expect(darkTheme).toContain("--ui-text-tertiary: #949494;");
    expect(contrastRatio("#0b1f16", "#13a072")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#0b1f16", "#15966a")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#949494", "#2d2d30")).toBeGreaterThanOrEqual(4.5);
    expect(appToasterTsx).toContain('secondary: "var(--on-accent)"');
  });

  it("强调按钮始终使用主题定义的前景色", () => {
    expect(errorBoundaryCss).toMatch(
      /\.error-boundary-btn\.primary\s*\{[\s\S]*?color:\s*var\(--on-accent, #fff\);/,
    );
    expect(errorBoundaryCss).toMatch(
      /\.error-boundary-btn\.primary:hover\s*\{[\s\S]*?color:\s*var\(--on-accent, #fff\);/,
    );
    expect(updateModalCss).toMatch(
      /\.update-modal-btn\.primary\s*\{[\s\S]*?color:\s*var\(--on-accent, #fff\);/,
    );
    expect(updateModalCss).toMatch(
      /\.update-modal-btn\.primary:hover\s*\{[\s\S]*?color:\s*var\(--on-accent, #fff\);/,
    );
  });

  it("文件栏显隐按钮固定在窗口左侧中线", () => {
    expect(appCss).toMatch(
      /\.history-toggle\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?left:\s*12px;[\s\S]*?top:\s*50%;[\s\S]*?width:\s*28px;[\s\S]*?border:\s*0;[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none;[\s\S]*?transform:\s*translateY\(-50%\);/,
    );
    expect(appTsx).toContain("ChevronLeft");
    expect(appTsx).toContain("ChevronRight");
    expect(appCss).toMatch(
      /\.history-toggle:focus-visible\s*\{[\s\S]*?outline:\s*2px solid var\(--accent-primary\);/,
    );
  });

  it("文件栏关键操作保留清晰的键盘焦点", () => {
    expect(fileSidebarCss).toMatch(
      /\.fs-workspace-info:focus-visible,[\s\S]*?\.fs-sort-option:focus-visible\s*\{[\s\S]*?outline:\s*2px solid var\(--accent-primary\);/,
    );
    expect(fileSidebarCss).toMatch(
      /\.fs-quick-actions\s*\{[\s\S]*?justify-content:\s*space-between;/,
    );
  });

  it("文件栏融入页面背景且不使用描边卡片强调选中项", () => {
    expect(appCss).toMatch(
      /\.history-pane__content\s*\{[\s\S]*?background:\s*transparent;[\s\S]*?border-right:\s*0;/,
    );
    expect(fileSidebarCss).toMatch(
      /\.fs-item\.active,[\s\S]*?\.fs-folder\.active\s*\{[\s\S]*?border-color:\s*transparent;/,
    );
    expect(historyPanelCss).toMatch(
      /\.history-item\.active\s*\{[\s\S]*?border-color:\s*transparent;/,
    );
    expect(sidebarFooterCss).toMatch(
      /\.sidebar-footer\s*\{[\s\S]*?border-top:\s*0;/,
    );
  });

  it("文件列表滚动条在未悬停时保持可见", () => {
    expect(appCss).toMatch(
      /\.fs-list,[\s\S]*?\.history-list\s*\{[\s\S]*?scrollbar-gutter:\s*stable;[\s\S]*?scrollbar-color:\s*color-mix\(/,
    );
    expect(appCss).toMatch(
      /\.fs-list::-webkit-scrollbar-thumb,[\s\S]*?\.history-list::-webkit-scrollbar-thumb\s*\{[\s\S]*?background:\s*color-mix\(/,
    );
  });

  it("全局反馈提示使用克制圆角而不是胶囊形", () => {
    expect(appToasterCss).toMatch(
      /\.premium-toast\s*\{[\s\S]*?border-radius:\s*10px;/,
    );
  });
});
