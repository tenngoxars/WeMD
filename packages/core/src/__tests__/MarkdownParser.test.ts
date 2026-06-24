import { afterEach, describe, expect, it, vi } from "vitest";
import { createMarkdownParser } from "../MarkdownParser";

describe("MarkdownParser code block", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("默认不输出 mac-sign 结构", () => {
    const parser = createMarkdownParser();
    const html = parser.render("```ts\nconst a = 1;\n```");

    expect(html).toContain('<pre class="custom">');
    expect(html).not.toContain('<span class="mac-sign"');
    expect(html).not.toContain("<svg");
  });

  it("显式开启后输出 md 风格的 mac-sign 结构", () => {
    const parser = createMarkdownParser({ showMacBar: true });
    const html = parser.render("```ts\nconst a = 1;\n```");

    expect(html).toContain('<pre class="custom">');
    expect(html).toContain('<span class="mac-sign"');
    expect(html).toContain("<svg");
    expect(html).toMatch(/<pre[^>]*>\s*<span[^>]*>[\s\S]*<\/span>\s*<code/i);
    expect(html).not.toMatch(/<code[^>]*>[\s\S]*<svg/i);
  });

  it("指定 katex 渲染器时不使用 MathJax SVG", () => {
    vi.stubGlobal("window", {
      MathJax: {
        tex2svg: () => {
          const container = document.createElement("div");
          container.innerHTML = "<svg><text>mathjax</text></svg>";
          return container;
        },
      },
    });

    const parser = createMarkdownParser({ mathRenderer: "katex" });
    const html = parser.render("$\\boldsymbol{x}$");

    expect(html).toContain("katex-html");
    expect(html).toContain("boldsymbol");
    expect(html).not.toContain("<svg");
    expect(html).not.toContain("mathjax");
  });
});
