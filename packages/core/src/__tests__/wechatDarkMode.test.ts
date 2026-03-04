import { describe, expect, it } from "vitest";
import {
  convertToWeChatDarkMode,
  convertCssToWeChatDarkMode,
  _convertCssToWeChatDarkModeInternal,
} from "../wechatDarkMode";

describe("convertToWeChatDarkMode", () => {
  it("白色文字在暗色模式下保持高亮度", () => {
    const result = convertToWeChatDarkMode("#ffffff", "body");
    // 白色文字在深色背景上应保持白色或接近白色以保证可读性
    const r = parseInt(result.slice(1, 3), 16);
    expect(r).toBeGreaterThan(200);
  });

  it("白色背景在暗色模式下变暗", () => {
    const result = convertToWeChatDarkMode("#ffffff", "background");
    // 白色背景应转为深色
    const r = parseInt(result.slice(1, 3), 16);
    expect(r).toBeLessThan(100);
  });

  it("将黑色文字转为亮色", () => {
    const result = convertToWeChatDarkMode("#000000", "body");
    // 黑色文字在暗色模式下应变亮以保证可读性
    const r = parseInt(result.slice(1, 3), 16);
    expect(r).toBeGreaterThan(80);
  });

  it("彩色保持色相", () => {
    const result = convertToWeChatDarkMode("#ff0000", "body");
    // 红色转换后仍应偏红
    const r = parseInt(result.slice(1, 3), 16);
    const g = parseInt(result.slice(3, 5), 16);
    const b = parseInt(result.slice(5, 7), 16);
    expect(r).toBeGreaterThan(g);
    expect(r).toBeGreaterThan(b);
  });

  it("不同 ElementType 产生不同结果", () => {
    const hex = "#cccccc";
    const bodyResult = convertToWeChatDarkMode(hex, "body");
    const codeResult = convertToWeChatDarkMode(hex, "code");
    const headingResult = convertToWeChatDarkMode(hex, "heading");
    // 不同类型的元素应有不同的暗色处理策略
    expect(
      new Set([bodyResult, codeResult, headingResult]).size,
    ).toBeGreaterThanOrEqual(2);
  });

  it("background 类型将亮色背景变暗", () => {
    const result = convertToWeChatDarkMode("#f5f5f5", "background");
    const r = parseInt(result.slice(1, 3), 16);
    expect(r).toBeLessThan(80);
  });

  it("无效 hex 返回原值", () => {
    expect(convertToWeChatDarkMode("not-a-color")).toBe("not-a-color");
    expect(convertToWeChatDarkMode("xyz")).toBe("xyz");
  });

  it("返回有效的 hex 格式", () => {
    const result = convertToWeChatDarkMode("#3366ff", "body");
    expect(result).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("code-text 类型保证代码文字可读", () => {
    const result = convertToWeChatDarkMode("#333333", "code-text");
    // 深色代码文字在暗色模式下应变亮
    const r = parseInt(result.slice(1, 3), 16);
    const g = parseInt(result.slice(3, 5), 16);
    const b = parseInt(result.slice(5, 7), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    expect(brightness).toBeGreaterThan(60);
  });

  it("selection 类型处理选区颜色", () => {
    const result = convertToWeChatDarkMode("#0078d4", "selection");
    expect(result).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("convertCssToWeChatDarkMode", () => {
  it("转换简单 CSS 规则中的颜色", () => {
    const css = "p { color: #000000; }";
    const result = convertCssToWeChatDarkMode(css);
    expect(result).toContain("/* wemd-wechat-dark-converted */");
    expect(result).not.toContain("#000000");
  });

  it("转换 background-color", () => {
    const css = ".container { background-color: #ffffff; }";
    const result = convertCssToWeChatDarkMode(css);
    expect(result).not.toContain("#ffffff");
  });

  it("转换 border-color", () => {
    const css = "table { border: 1px solid #dddddd; }";
    const result = convertCssToWeChatDarkMode(css);
    expect(result).not.toContain("#dddddd");
  });

  it("处理 rgb() 颜色值", () => {
    const css = "p { color: rgb(0, 0, 0); }";
    const result = convertCssToWeChatDarkMode(css);
    expect(result).not.toContain("rgb(0, 0, 0)");
  });

  it("处理 rgba() 颜色值并保留 alpha", () => {
    const css = "p { color: rgba(0, 0, 0, 0.5); }";
    const result = convertCssToWeChatDarkMode(css);
    expect(result).toContain("0.5");
    expect(result).toContain("rgba(");
  });

  it("跳过 CSS 关键字颜色", () => {
    const css = "p { color: inherit; background: transparent; }";
    const result = convertCssToWeChatDarkMode(css);
    expect(result).toContain("inherit");
    expect(result).toContain("transparent");
  });

  it("跳过 var() 引用", () => {
    const css = "p { color: var(--text-color); }";
    const result = convertCssToWeChatDarkMode(css);
    expect(result).toContain("var(--text-color)");
  });

  it("跳过 gradient 值", () => {
    const css = "div { background: linear-gradient(#fff, #000); }";
    const result = convertCssToWeChatDarkMode(css);
    expect(result).toContain("linear-gradient");
  });

  it("处理 @media 规则", () => {
    const css = "@media screen { p { color: #000; } }";
    const result = convertCssToWeChatDarkMode(css);
    expect(result).toContain("@media screen");
  });

  it("空 CSS 不报错", () => {
    expect(() => convertCssToWeChatDarkMode("")).not.toThrow();
    expect(() => convertCssToWeChatDarkMode("   ")).not.toThrow();
  });

  it("无颜色的 CSS 不报错", () => {
    const css = "p { font-size: 14px; margin: 10px; }";
    const result = convertCssToWeChatDarkMode(css);
    expect(result).toContain("font-size");
    expect(result).toContain("margin");
  });

  it("已转换的 CSS 不重复转换", () => {
    const css = "p { color: #000; }";
    const first = convertCssToWeChatDarkMode(css);
    const second = convertCssToWeChatDarkMode(first);
    expect(second).toBe(first);
  });

  it("根据选择器识别元素类型", () => {
    const cssCode = "pre code.hljs { color: #333; background-color: #f8f8f8; }";
    const cssTable = "table td { color: #333; background-color: #f8f8f8; }";
    const resultCode = convertCssToWeChatDarkMode(cssCode);
    const resultTable = convertCssToWeChatDarkMode(cssTable);
    // 代码块和表格应有不同的暗色转换策略
    expect(resultCode).not.toBe(resultTable);
  });

  it("处理多条规则", () => {
    const css =
      "h1 { color: #000; } p { color: #333; } code { background: #f5f5f5; }";
    const result = convertCssToWeChatDarkMode(css);
    expect(result).toContain("h1");
    expect(result).toContain("p{");
    expect(result).toContain("code");
  });

  it("处理 3 位短 hex", () => {
    const css = "p { color: #000; }";
    const result = convertCssToWeChatDarkMode(css);
    expect(result).not.toContain("#000");
  });
});

describe("_convertCssToWeChatDarkModeInternal", () => {
  it("始终执行转换，不使用缓存", () => {
    const css = "p { color: #111; }";
    const result1 = _convertCssToWeChatDarkModeInternal(css);
    const result2 = _convertCssToWeChatDarkModeInternal(css);
    // 内部函数每次都重新转换
    expect(result1).toBe(result2);
    expect(result1).toContain("/* wemd-wechat-dark-converted */");
  });
});
