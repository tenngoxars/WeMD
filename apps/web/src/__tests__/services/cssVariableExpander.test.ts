import { describe, expect, it } from "vitest";
import { expandCSSVariables } from "../../services/cssVariableExpander";

describe("expandCSSVariables", () => {
  it("expands simple var() references", () => {
    const css = `
      #wemd { --wemd-font-size: 14px; --wemd-text-color: #333; }
      #wemd p { font-size: var(--wemd-font-size); color: var(--wemd-text-color); }
    `;
    const result = expandCSSVariables(css);

    expect(result).toContain("font-size: 14px");
    expect(result).toContain("color: #333");
    expect(result).not.toContain("var(--wemd-font-size)");
    expect(result).not.toContain("var(--wemd-text-color)");
  });

  it("removes custom property declarations", () => {
    const css = `
      #wemd { --wemd-font-size: 14px; font-family: serif; }
      #wemd p { font-size: var(--wemd-font-size); }
    `;
    const result = expandCSSVariables(css);

    expect(result).not.toMatch(/--wemd-font-size\s*:/);
    expect(result).toContain("font-family: serif");
    expect(result).toContain("font-size: 14px");
  });

  it("removes empty rule blocks after stripping declarations", () => {
    const css = `
      #wemd { --wemd-font-size: 14px; }
      #wemd p { font-size: var(--wemd-font-size); }
    `;
    const result = expandCSSVariables(css);

    // 只含变量声明的规则块应被移除
    expect(result).not.toMatch(/#wemd\s*\{\s*\}/);
    expect(result).toContain("font-size: 14px");
  });

  it("handles var() with fallback", () => {
    const css = `
      #wemd p { color: var(--undefined-var, #999); }
    `;
    const result = expandCSSVariables(css);

    expect(result).toContain("color: #999");
    expect(result).not.toContain("var(");
  });

  it("resolves chained variable references", () => {
    const css = `
      #wemd { --a: 16px; --b: var(--a); }
      #wemd p { font-size: var(--b); }
    `;
    const result = expandCSSVariables(css);

    expect(result).toContain("font-size: 16px");
    expect(result).not.toContain("var(");
  });

  it("falls back on circular variable references", () => {
    const css = `
      #wemd { --a: var(--b); --b: var(--a); }
      #wemd p { color: var(--a, #fallback); }
    `;
    const result = expandCSSVariables(css);

    expect(result).toContain("color: #fallback");
    expect(result).not.toContain("var(--a");
    expect(result).not.toContain("var(--b");
  });

  it("returns css unchanged when no var() present", () => {
    const css = "#wemd p { font-size: 14px; color: #333; }";
    expect(expandCSSVariables(css)).toBe(css);
  });

  it("returns empty string for empty input", () => {
    expect(expandCSSVariables("")).toBe("");
  });

  it("handles rgba and complex values", () => {
    const css = `
      #wemd { --wemd-primary: #1677ff; --wemd-primary-20: rgba(22, 119, 255, 0.12); }
      #wemd strong { background: var(--wemd-primary-20); color: var(--wemd-primary); }
    `;
    const result = expandCSSVariables(css);

    expect(result).toContain("background: rgba(22, 119, 255, 0.12)");
    expect(result).toContain("color: #1677ff");
    expect(result).not.toContain("var(");
  });

  it("handles nested var() in fallback", () => {
    const css = `
      #wemd { --wemd-primary: blue; }
      #wemd a { color: var(--missing, var(--wemd-primary)); }
    `;
    const result = expandCSSVariables(css);

    expect(result).toContain("color: blue");
    expect(result).not.toContain("var(");
  });

  it("preserves non-variable properties in mixed rule blocks", () => {
    const css = `
      #wemd { --wemd-font-size: 14px; padding: 0 8px; color: #333; overflow-wrap: break-word; }
    `;
    const result = expandCSSVariables(css);

    expect(result).toContain("padding: 0 8px");
    expect(result).toContain("color: #333");
    expect(result).toContain("overflow-wrap: break-word");
    expect(result).not.toMatch(/--wemd-font-size\s*:/);
  });
});
