import { describe, expect, it } from "vitest";
import { processHtml } from "@wemd/core";
import { resolveInlineStyleVariablesForCopy } from "../../services/inlineStyleVarResolver";
import { normalizeCopyContainer } from "../../services/wechatCopyService";
import { defaultVariables } from "../../components/Theme/ThemeDesigner/defaults";
import { generateCSS } from "../../components/Theme/ThemeDesigner/generateCSS";

describe("wechat copy css integration", () => {
  it("resolves inline var() values with scope-aware computed values", () => {
    const html = "<p>段落</p>";
    const css = `
      #wemd {
        --wemd-font-size: 14px;
        --wemd-text-color: #123456;
        --wemd-paragraph-margin: 18px;
      }
      #wemd p {
        font-size: var(--wemd-font-size);
        color: var(--wemd-text-color);
        margin: var(--wemd-paragraph-margin) 0;
      }
    `;

    const output = resolveInlineStyleVariablesForCopy(
      processHtml(html, css, true, true),
    );

    const container = document.createElement("div");
    container.innerHTML = output;
    const paragraph = container.querySelector("p");

    expect(paragraph).toBeTruthy();
    expect(paragraph!.style.fontSize).toBe("14px");
    expect(paragraph!.style.color).toBe("rgb(18, 52, 86)");
    expect(paragraph!.style.marginTop).toBe("18px");
    expect(paragraph!.style.marginBottom).toBe("18px");
    expect(output).toContain("margin-top: 18px;");
    expect(output).toContain("margin-bottom: 18px;");
    expect(output).not.toContain("var(--wemd-font-size)");
    expect(output).not.toContain("var(--wemd-text-color)");
    expect(output).not.toContain("var(--wemd-paragraph-margin)");
  });

  it("keeps literal var() text inside quoted string values", () => {
    const html = "<p>段落</p>";
    const css = `
      #wemd p {
        font-family: "var(--fake-family)";
        color: var(--wemd-text-color, #222222);
      }
    `;

    const output = resolveInlineStyleVariablesForCopy(
      processHtml(html, css, true, true),
    );
    const container = document.createElement("div");
    container.innerHTML = output;
    const paragraph = container.querySelector("p");

    expect(paragraph).toBeTruthy();
    expect(paragraph!.style.fontFamily).toContain("var(--fake-family)");
    expect(paragraph!.style.color).toBe("rgb(34, 34, 34)");
  });

  it("resolves same custom property name based on local scope", () => {
    const html = `<p>root</p><blockquote><p>quote</p></blockquote>`;
    const css = `
      #wemd {
        --text-color: #111111;
      }
      #wemd p {
        color: var(--text-color);
      }
      #wemd blockquote {
        --text-color: #222222;
      }
    `;

    const output = resolveInlineStyleVariablesForCopy(
      processHtml(html, css, true, true),
    );
    const container = document.createElement("div");
    container.innerHTML = output;
    const paragraphs = container.querySelectorAll("p");

    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0].style.color).toBe("rgb(17, 17, 17)");
    expect(paragraphs[1].style.color).toBe("rgb(34, 34, 34)");
    expect(output).not.toContain("var(--text-color)");
  });

  it("falls back when circular custom properties cannot be resolved", () => {
    const html = "<p>段落</p>";
    const css = `
      #wemd {
        --a: var(--b);
        --b: var(--a);
      }
      #wemd p {
        color: var(--a, #334455);
        background-color: var(--missing-bg, #fafafa);
      }
    `;

    const output = resolveInlineStyleVariablesForCopy(
      processHtml(html, css, true, true),
    );
    const container = document.createElement("div");
    container.innerHTML = output;
    const paragraph = container.querySelector("p");

    expect(paragraph).toBeTruthy();
    expect(paragraph!.style.color).toBe("rgb(51, 68, 85)");
    expect(paragraph!.style.backgroundColor).toBe("rgb(250, 250, 250)");
    expect(output).not.toContain("var(--a");
    expect(output).not.toContain("var(--b");
    expect(output).not.toMatch(/--(?:a|b)\s*:/);
  });

  it("materializes visual theme styles without remaining css variables", () => {
    const html = `
      <h2><span class="content">标题</span></h2>
      <p>正文段落</p>
      <blockquote><p>引用内容</p></blockquote>
      <ul><li>列表项</li></ul>
    `;
    const css = generateCSS(defaultVariables);

    const output = resolveInlineStyleVariablesForCopy(
      processHtml(html, css, true, true),
    );
    const container = document.createElement("div");
    container.innerHTML = output;
    const paragraph = container.querySelector("p");
    const heading = container.querySelector("h2 .content");

    expect(paragraph).toBeTruthy();
    expect(heading).toBeTruthy();
    expect(paragraph!.style.fontSize).toBeTruthy();
    expect(paragraph!.style.lineHeight).toBeTruthy();
    expect(heading!.getAttribute("style")).toContain("font-size");
    expect(output).not.toContain("var(--wemd-");
    expect(output).not.toMatch(/--wemd-[\w-]+\s*:/);
  });

  it("relocates horizontal page padding in full pipeline", () => {
    const html = "<p>段落</p><h2><span class='content'>标题</span></h2>";
    const css = generateCSS({
      ...defaultVariables,
      pagePadding: 48,
    });

    const resolved = resolveInlineStyleVariablesForCopy(
      processHtml(html, css, true, true),
    );
    const container = document.createElement("div");
    container.innerHTML = resolved;

    normalizeCopyContainer(container);

    const paragraph = container.querySelector("p") as HTMLElement | null;
    const heading = container.querySelector("h2") as HTMLElement | null;
    expect(paragraph).toBeTruthy();
    expect(heading).toBeTruthy();
    expect(paragraph!.style.paddingLeft).toBe("48px");
    expect(paragraph!.style.paddingRight).toBe("48px");
    expect(heading!.style.paddingLeft).toBe("48px");
    expect(heading!.style.paddingRight).toBe("48px");
  });
});
