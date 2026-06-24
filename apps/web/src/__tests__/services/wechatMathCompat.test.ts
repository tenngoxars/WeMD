import { describe, expect, it } from "vitest";

import { stripHiddenMathMarkupForWechat } from "../../services/wechatMathCompat";

describe("wechatMathCompat", () => {
  it("removes hidden KaTeX MathML and TeX source before WeChat copy", () => {
    const container = document.createElement("div");
    container.innerHTML = `
      <section id="wemd">
        <p>
          <span class="inline-equation" data-latex="\\boldsymbol{x}">
            <span class="katex">
              <span class="katex-mathml">
                <math>
                  <semantics>
                    <mrow><mi>x</mi></mrow>
                    <annotation encoding="application/x-tex">\\boldsymbol{x}</annotation>
                  </semantics>
                </math>
              </span>
              <span class="katex-html" aria-hidden="true">
                <span class="base" style="width: min-content;">
                  <span class="mord boldsymbol">x</span>
                </span>
              </span>
            </span>
          </span>
        </p>
      </section>
    `;

    stripHiddenMathMarkupForWechat(container);

    expect(container.querySelector(".katex-mathml")).toBeNull();
    expect(container.querySelector("annotation")).toBeNull();
    expect(container.querySelector("[data-latex]")).toBeNull();
    expect(container.querySelector(".katex-html")).toBeTruthy();
    expect(container.innerHTML).not.toContain("\\boldsymbol");
    expect(container.querySelector(".boldsymbol")?.textContent).toBe(
      String.fromCodePoint(0x1d499),
    );

    const base = container.querySelector<HTMLElement>(".base");
    expect(base?.style.getPropertyValue("white-space")).toBe("nowrap");
    expect(base?.style.getPropertyValue("width")).toBe("auto");
  });
});
