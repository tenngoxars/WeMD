/// <reference types="node" />

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const headerSource = readFileSync("src/components/Header/Header.tsx", "utf8");
const modalCss = readFileSync("src/components/common/Modal.css", "utf8");
const panelSource = readFileSync(
  "src/components/Settings/ImageHostSettingsPanels.tsx",
  "utf8",
);
const settingsSource = readFileSync(
  "src/components/Settings/ImageHostSettings.tsx",
  "utf8",
);
const themePanelSource = readFileSync(
  "src/components/Theme/ThemePanelView.tsx",
  "utf8",
);
const settingsCss = readFileSync(
  "src/components/Settings/ImageHostSettings.css",
  "utf8",
);

describe("图床设置弹窗视觉与滚动约束", () => {
  it("顶栏入口和弹窗标题均使用图床设置", () => {
    expect(headerSource).toMatch(/>\s*图床设置\s*<\/button>/);
    expect(headerSource).toMatch(/title="图床设置"/);
  });

  it("为使用中状态保留明确标识和官方图床状态动画", () => {
    expect(settingsCss).toMatch(
      /\.tab-active-badge::before\s*\{[\s\S]*?content:\s*"";[\s\S]*?background:\s*var\(--accent-primary\);/,
    );
    expect(settingsCss).toMatch(
      /\.pulsing-dot::after\s*\{[\s\S]*?content:\s*"";[\s\S]*?animation:\s*image-host-pulse/,
    );
    expect(settingsCss).toMatch(/@keyframes image-host-pulse/);
  });

  it("区分测试连接与启用按钮的视觉层级", () => {
    expect(panelSource).toMatch(/className="btn-test-connection"/);
    expect(settingsCss).toMatch(
      /\.host-config \.btn-test-connection\s*\{[\s\S]*?background:\s*var\(--bg-secondary\);/,
    );
    expect(settingsCss).toMatch(
      /\.host-config \.btn-activate\s*\{[\s\S]*?display:\s*block;[\s\S]*?width:\s*auto;[\s\S]*?margin:\s*8px 0 0 auto;[\s\S]*?background:\s*var\(--accent-primary\);/,
    );
  });

  it("固定图床弹窗工作区高度并让长配置在内部滚动", () => {
    expect(modalCss).toMatch(
      /\.modal-panel\.image-host-modal\s*\{[\s\S]*?height:\s*min\(/,
    );
    expect(settingsCss).toMatch(
      /\.host-config\s*\{[\s\S]*?flex:\s*1;[\s\S]*?overflow-y:\s*auto;/,
    );
  });

  it("通用弹窗采用统一的 12px 圆角", () => {
    expect(modalCss).toMatch(
      /\.modal-panel\s*\{[\s\S]*?border-radius:\s*12px;/,
    );
    expect(modalCss).toMatch(
      /@media \(max-width: 640px\)\s*\{[\s\S]*?\.modal-panel,[\s\S]*?border-radius:\s*12px;/,
    );
  });

  it("官方图床使用设置页结构而不是居中的营销卡片", () => {
    expect(panelSource).toContain('className="official-host-summary"');
    expect(panelSource).toContain('className="official-feature-list"');
    expect(settingsCss).toMatch(
      /\.official-host-intro\s*\{[\s\S]*?justify-content:\s*flex-start;/,
    );
    expect(settingsCss).not.toMatch(
      /\.feature-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3/,
    );
  });

  it("微信图床面板常驻 IP 白名单提示", () => {
    expect(panelSource).toContain("IP 白名单");
    expect(panelSource).toContain("40164");
    expect(panelSource).toContain("测试号无此限制");
  });

  it("设置弹窗不使用 emoji 表达状态或提示", () => {
    const emojiPattern = /[✅❌💡]/u;
    expect(settingsSource).not.toMatch(emojiPattern);
    expect(panelSource).not.toMatch(emojiPattern);
    expect(themePanelSource).not.toMatch(emojiPattern);
  });
});
