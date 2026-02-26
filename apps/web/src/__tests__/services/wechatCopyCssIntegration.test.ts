import { describe, expect, it } from "vitest";
import { processHtml } from "@wemd/core";
import { resolveInlineStyleVariablesForCopy } from "../../services/inlineStyleVarResolver";

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
});
