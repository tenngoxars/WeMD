/// <reference types="node" />

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const headerCss = readFileSync("src/components/Header/Header.css", "utf8");
const headerSource = readFileSync("src/components/Header/Header.tsx", "utf8");
const localFontsCss = readFileSync("src/styles/local-fonts.css", "utf8");
const themePanelCss = readFileSync(
  "src/components/Theme/ThemePanel.css",
  "utf8",
);

describe("Header 字标排版", () => {
  it("使用官网同款 JetBrains Mono Regular 字标", () => {
    expect(headerCss).toMatch(
      /\.logo-text\s*\{[\s\S]*?"JetBrains Mono"[\s\S]*?font-size:\s*0\.875rem;[\s\S]*?font-weight:\s*400;[\s\S]*?line-height:\s*20px;[\s\S]*?letter-spacing:\s*0\.1em;/,
    );
    expect(localFontsCss).toMatch(
      /font-family:\s*"JetBrains Mono";[\s\S]*?font-weight:\s*400;[\s\S]*?jetbrains-mono-latin-regular\.woff2/,
    );
  });

  it("让顶栏操作共用一致的控件与图标尺寸", () => {
    expect(headerCss).toMatch(
      /\.btn-icon-only,\s*\.btn-ghost\s*\{[\s\S]*?width:\s*34px;[\s\S]*?height:\s*34px;[\s\S]*?border-radius:\s*9px;/,
    );
    expect(headerCss).toMatch(
      /\.btn-secondary,\s*\.btn-primary\s*\{[\s\S]*?height:\s*34px;[\s\S]*?gap:\s*6px;[\s\S]*?border-radius:\s*9px;/,
    );
    expect(headerCss).toMatch(
      /\.btn-icon-only svg,[\s\S]*?\.btn-ghost svg\s*\{[\s\S]*?width:\s*16px;[\s\S]*?height:\s*16px;/,
    );
    expect(headerCss).toMatch(
      /\.app-header \.header-action-button\s*\{[\s\S]*?border-radius:\s*9px;[\s\S]*?background-image:\s*none;[\s\S]*?box-shadow:\s*none;/,
    );
  });

  it("让右侧操作形成中性工具到主要复制的清晰层级", () => {
    expect(headerSource).toContain(
      'className="btn-icon-only header-theme-toggle"',
    );
    expect(headerSource).toContain(
      'className="btn-icon-only header-copy-html"',
    );
    expect(headerCss).toMatch(/\.header-right\s*\{[\s\S]*?gap:\s*6px;/);
    expect(headerCss).toMatch(
      /\.app-header \.header-theme-toggle,[\s\S]*?\.app-header \.header-copy-html\s*\{[\s\S]*?border:\s*1px solid transparent;[\s\S]*?background:\s*transparent;[\s\S]*?color:\s*var\(--text-secondary\);/,
    );
    expect(headerCss).toMatch(
      /\.app-header \.header-action-secondary\s*\{[\s\S]*?background-color:\s*transparent;/,
    );
    expect(headerCss).toMatch(
      /\.app-header \.header-action-primary\s*\{[\s\S]*?background-color:\s*var\(--accent-primary\);/,
    );
  });

  it("主题面板按钮样式不会泄漏并覆盖顶栏操作", () => {
    expect(themePanelCss).not.toMatch(/(?:^|\n)\.btn-(?:secondary|primary)/);
    expect(themePanelCss).toMatch(
      /\.theme-modal \.btn-secondary,\s*\.theme-modal \.btn-primary/,
    );
  });
});
