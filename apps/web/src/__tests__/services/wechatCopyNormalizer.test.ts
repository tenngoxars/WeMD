import { describe, expect, it } from "vitest";
import {
  normalizeCopyContainer,
  stripCopyMetadata,
} from "../../services/wechatCopyNormalizer";

describe("wechatCopyNormalizer", () => {
  it("strips only copy metadata from copied container", () => {
    const container = document.createElement("div");
    container.innerHTML =
      '<section id="wemd"><p data-tool="WeMD编辑器" data-source="x">A<span id="wemd">inner</span></p><h1 data-tool="WeMD编辑器" data-kind="title">B</h1><code data-any="1" data-wemd-counter-generated="before">C</code></section>';

    stripCopyMetadata(container);

    expect(container.querySelectorAll("#wemd")).toHaveLength(1);
    expect(container.innerHTML).not.toContain("data-tool=");
    expect(container.innerHTML).not.toContain("data-wemd-counter-generated=");
    expect(container.innerHTML).toContain('data-source="x"');
    expect(container.innerHTML).toContain('data-kind="title"');
    expect(container.innerHTML).toContain('data-any="1"');
  });

  it("converts #wemd root section to div and strips only transparent root background styles", () => {
    const container = document.createElement("div");
    container.innerHTML =
      '<section id="wemd" style="background: transparent; background-color: transparent; color: rgb(9, 9, 9);"><p style="margin-top:18px; background-color: transparent;">A</p><p style="background: rgb(1, 2, 3);">B</p></section>';

    normalizeCopyContainer(container);

    const section = container.querySelector("section");
    expect(section).toBeNull();
    const rootDiv = container.firstElementChild as HTMLElement | null;
    expect(rootDiv).toBeTruthy();
    expect(rootDiv!.tagName).toBe("DIV");
    expect(rootDiv!.id).toBe("");
    expect(rootDiv!.style.color).toBe("rgb(9, 9, 9)");
    expect(rootDiv!.style.background).toBe("");
    expect(rootDiv!.style.backgroundColor).toBe("");

    const paragraphs = container.querySelectorAll("p");
    expect(paragraphs[0].style.marginTop).toBe("18px");
    expect(paragraphs[0].style.backgroundColor).toBe("transparent");
    expect(paragraphs[0].style.backgroundImage).toBe("none");
    expect(paragraphs[1].style.background).toContain("rgb(1, 2, 3)");
    expect(paragraphs[1].style.backgroundColor).not.toBe("transparent");
  });

  it("relocates root horizontal padding to direct children", () => {
    const container = document.createElement("div");
    container.innerHTML =
      '<section id="wemd" style="padding: 0px 16px; color: rgb(9, 9, 9);"><p>A</p><p>B</p></section>';

    normalizeCopyContainer(container);

    const rootDiv = container.firstElementChild as HTMLElement | null;
    expect(rootDiv).toBeTruthy();
    expect(rootDiv!.tagName).toBe("DIV");
    expect(rootDiv!.style.padding).toBe("");
    expect(rootDiv!.style.paddingLeft).toBe("");
    expect(rootDiv!.style.paddingRight).toBe("");

    const paragraphs = rootDiv!.querySelectorAll("p");
    expect(paragraphs).toHaveLength(2);
    expect((paragraphs[0] as HTMLElement).style.paddingLeft).toBe("16px");
    expect((paragraphs[0] as HTMLElement).style.paddingRight).toBe("16px");
    expect((paragraphs[1] as HTMLElement).style.paddingLeft).toBe("16px");
    expect((paragraphs[1] as HTMLElement).style.paddingRight).toBe("16px");
  });

  it("keeps blockquote inner padding and relocates root horizontal padding via margin", () => {
    const container = document.createElement("div");
    container.innerHTML =
      '<section id="wemd" style="padding: 0px 16px;"><blockquote style="padding: 12px 10px;"><p>A</p></blockquote></section>';

    normalizeCopyContainer(container);

    const blockquote = container.querySelector("blockquote") as HTMLElement;
    expect(blockquote).toBeTruthy();
    expect(blockquote.style.paddingLeft).toBe("10px");
    expect(blockquote.style.paddingRight).toBe("10px");
    expect(blockquote.style.marginLeft).toBe("16px");
    expect(blockquote.style.marginRight).toBe("16px");
  });

  it("keeps callout inner padding and relocates root horizontal padding via margin", () => {
    const container = document.createElement("div");
    container.innerHTML =
      '<section id="wemd" style="padding: 0px 16px;"><section class="callout callout-note" style="padding: 12px 16px;"><div class="callout-title">Note</div><p>内容</p></section></section>';

    normalizeCopyContainer(container);

    const callout = container.querySelector(".callout") as HTMLElement;
    expect(callout).toBeTruthy();
    expect(callout.style.paddingLeft).toBe("16px");
    expect(callout.style.paddingRight).toBe("16px");
    expect(callout.style.marginLeft).toBe("16px");
    expect(callout.style.marginRight).toBe("16px");
  });

  it("keeps pre inner padding and relocates root horizontal padding via margin", () => {
    const container = document.createElement("div");
    container.innerHTML =
      '<section id="wemd" style="padding: 0px 16px;"><pre style="padding: 10px 12px; background: rgb(30,30,30);"><code>console.log(1)</code></pre></section>';

    normalizeCopyContainer(container);

    const pre = container.querySelector("pre") as HTMLElement;
    expect(pre).toBeTruthy();
    expect(pre.style.paddingLeft).toBe("12px");
    expect(pre.style.paddingRight).toBe("12px");
    expect(pre.style.marginLeft).toBe("16px");
    expect(pre.style.marginRight).toBe("16px");
  });

  it("keeps heading inner padding and relocates root horizontal padding via margin", () => {
    const container = document.createElement("div");
    container.innerHTML =
      '<section id="wemd" style="padding: 0px 16px;"><h3 style="padding-left: 8px; border-left: 4px solid rgb(0, 87, 255);"><span class="content">标题</span></h3></section>';

    normalizeCopyContainer(container);

    const heading = container.querySelector("h3") as HTMLElement;
    expect(heading).toBeTruthy();
    expect(heading.style.paddingLeft).toBe("8px");
    expect(heading.style.marginLeft).toBe("16px");
    expect(heading.style.marginRight).toBe("16px");
  });

  it("falls back to root padding when heading margin uses auto keyword", () => {
    const container = document.createElement("div");
    container.innerHTML =
      '<section id="wemd" style="padding: 0px 16px;"><h3 style="margin-left: auto; margin-right: auto; padding-left: 8px;"><span class="content">标题</span></h3></section>';

    normalizeCopyContainer(container);

    const heading = container.querySelector("h3") as HTMLElement;
    expect(heading).toBeTruthy();
    expect(heading.style.marginLeft).toBe("16px");
    expect(heading.style.marginRight).toBe("16px");
  });

  it("normalizes figure background without overriding explicit figure background", () => {
    const container = document.createElement("div");
    container.innerHTML =
      '<section id="wemd"><figure><img src="x.png" alt="x" /><figcaption>cap</figcaption></figure><figure style="background:#f5f5f5;"><img src="y.png" alt="y" /></figure></section>';

    normalizeCopyContainer(container);

    const figures = container.querySelectorAll("figure");
    expect(figures).toHaveLength(2);
    expect(figures[0].style.backgroundColor).toBe("transparent");
    expect(figures[0].style.backgroundImage).toBe("none");
    expect(figures[1].style.background).toContain("rgb(245, 245, 245)");
  });

  it("normalizes list item section background without overriding explicit section background", () => {
    const container = document.createElement("div");
    container.innerHTML =
      '<section id="wemd"><ul><li><section>A</section></li><li><section style="background-color:#f5f5f5;">B</section></li></ul></section>';

    normalizeCopyContainer(container);

    const sections = container.querySelectorAll("li > section");
    expect(sections).toHaveLength(2);
    expect((sections[0] as HTMLElement).style.backgroundColor).toBe(
      "transparent",
    );
    expect((sections[0] as HTMLElement).style.backgroundImage).toBe("none");
    expect((sections[1] as HTMLElement).style.backgroundColor).toBe(
      "rgb(245, 245, 245)",
    );
  });

  it("normalizes list container background without overriding explicit list background", () => {
    const container = document.createElement("div");
    container.innerHTML =
      '<section id="wemd"><ul><li><section>A</section></li></ul><ol style="background-color:#f5f5f5;"><li><section>B</section></li></ol></section>';

    normalizeCopyContainer(container);

    const ul = container.querySelector("ul") as HTMLElement | null;
    const ol = container.querySelector("ol") as HTMLElement | null;
    expect(ul).toBeTruthy();
    expect(ol).toBeTruthy();
    expect(ul!.style.backgroundColor).toBe("transparent");
    expect(ul!.style.backgroundImage).toBe("none");
    expect(ol!.style.backgroundColor).toBe("rgb(245, 245, 245)");
  });

  it("keeps explicit list background-image untouched", () => {
    const container = document.createElement("div");
    container.innerHTML =
      '<section id="wemd"><ul style="background-image:linear-gradient(#111,#222);"><li><section>A</section></li></ul></section>';

    normalizeCopyContainer(container);

    const ul = container.querySelector("ul") as HTMLElement | null;
    expect(ul).toBeTruthy();
    expect(ul!.style.backgroundImage).toContain("linear-gradient");
    expect(ul!.style.backgroundColor).not.toBe("transparent");
  });

  it("strips root transparent background written in modern color syntax", () => {
    const container = document.createElement("div");
    container.innerHTML =
      '<section id="wemd" style="background: #0000; background-color: rgb(0 0 0 / 0); color: rgb(1, 1, 1);"><p>A</p></section>';

    normalizeCopyContainer(container);

    const rootDiv = container.firstElementChild as HTMLElement | null;
    expect(rootDiv).toBeTruthy();
    expect(rootDiv!.style.background).toBe("");
    expect(rootDiv!.style.backgroundColor).toBe("");
    expect(rootDiv!.style.color).toBe("rgb(1, 1, 1)");
  });

  it("does not override background of elements inside blockquote with explicit background", () => {
    const container = document.createElement("div");
    container.innerHTML =
      '<section id="wemd" style="background-color: rgb(255, 255, 255);"><blockquote style="background-color: rgb(200, 200, 200);"><p>引用文字</p></blockquote><p>普通文字</p></section>';

    normalizeCopyContainer(container);

    const blockquote = container.querySelector("blockquote") as HTMLElement;
    const innerP = blockquote.querySelector("p") as HTMLElement;
    const outerP = container.querySelector("div > p") as HTMLElement;

    expect(innerP.style.backgroundColor).toBe("");
    expect(outerP.style.backgroundColor).toBe("rgb(255, 255, 255)");
  });
});
