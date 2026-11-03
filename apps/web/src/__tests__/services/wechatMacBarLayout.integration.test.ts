import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  clipboardWrite: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
  default: {
    error: mocked.toastError,
    success: mocked.toastSuccess,
  },
}));

vi.mock("../../services/wechatMathCompat", () => ({
  renderHighRiskMathAsImages: vi.fn(async () => ({ imageCount: 0 })),
  stripHiddenMathMarkupForWechat: vi.fn(),
}));

import { copyToWechat } from "../../services/wechatCopyService";

const MARKDOWN = `
\`\`\`js
const background = "section";
console.log(background);
\`\`\`

<pre class="plain-control"><code>普通代码块</code></pre>
`;

const CSS = `
  #wemd {
    /* 页面布局 */
    --wemd-page-padding: 18px;
    /* 背景 */
    --wemd-grid-color-x: rgba(217, 119, 6, 0.28);
    --wemd-grid-color-y: rgba(220, 38, 38, 0.2);
    padding: 24px var(--wemd-page-padding);
    background-color: #fffaf0;
    background-image:
      linear-gradient(90deg, var(--wemd-grid-color-x) 1px, transparent 1px),
      linear-gradient(0deg, var(--wemd-grid-color-y) 1px, transparent 1px);
    background-size: 20px 20px;
  }
  #wemd pre {
    color: #f8fafc;
    background-color: #1f2937;
  }
  #wemd pre.custom {
    padding: 0;
    overflow: hidden;
  }
  #wemd pre.custom > .mac-sign { display: block; }
  #wemd pre code {
    display: block;
    margin: 0;
    padding: 16px;
  }
  #wemd pre.plain-control { padding: 14px; }
`;

const readPixelStyle = (element: HTMLElement, property: string): number =>
  Number.parseFloat(element.style.getPropertyValue(property)) || 0;

describe("公众号背景文章的 Mac Bar 布局", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: vi.fn(() => null),
        removeItem: vi.fn(),
        setItem: vi.fn(),
      },
    });
    Object.defineProperty(window, "wemdDesktop", {
      configurable: true,
      value: {
        clipboard: {
          writeHTML: mocked.clipboardWrite.mockResolvedValue({ success: true }),
        },
        platform: "darwin",
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "wemdDesktop", {
      configurable: true,
      value: undefined,
    });
  });

  it("经过真实解析和 CSS 内联后仍保留独立、对齐的 Mac 顶栏", async () => {
    await copyToWechat(MARKDOWN, CSS, { showMacBar: true });

    expect(mocked.clipboardWrite).toHaveBeenCalledTimes(1);
    const [payload] = mocked.clipboardWrite.mock.calls[0] as [
      { html: string; text: string },
    ];
    const snapshot = document.createElement("div");
    snapshot.innerHTML = payload.html;
    const root = snapshot.firstElementChild as HTMLElement | null;
    const pre = snapshot.querySelector("pre.custom") as HTMLElement | null;
    const macSign = snapshot.querySelector(
      "pre.custom > .mac-sign",
    ) as HTMLElement | null;
    const image = macSign?.querySelector("img") as HTMLImageElement | null;
    const code = snapshot.querySelector(
      "pre.custom > code",
    ) as HTMLElement | null;
    const plainPre = snapshot.querySelector(
      "pre.plain-control",
    ) as HTMLElement | null;

    expect(root?.tagName).toBe("SECTION");
    expect(root?.style.backgroundImage).toContain("linear-gradient");
    expect(
      Array.from({ length: root?.style.length ?? 0 }, (_, index) =>
        root?.style.item(index),
      ).filter((name) => name?.startsWith("--")),
    ).toEqual([]);
    expect(image?.src).toBe("https://img.wemd.app/1785143461387_dwk0yi.svg");
    expect(macSign?.nextElementSibling).toBe(code);
    expect(code?.style.display).toBe("block");
    expect(plainPre?.style.padding).toBe("14px");
    expect(pre?.style.padding).toBe("0px");
    expect(macSign?.style.paddingTop).toBe("10px");
    expect(macSign?.style.paddingRight).toBe("14px");
    expect(macSign?.style.paddingBottom).toBe("0px");
    expect(macSign?.style.paddingLeft).toBe("14px");
    expect(code?.style.padding).toBe("16px");

    const dotLeft =
      readPixelStyle(pre!, "padding-left") +
      readPixelStyle(macSign!, "padding-left") +
      readPixelStyle(image!, "margin-left");
    const codeLeft =
      readPixelStyle(pre!, "padding-left") +
      readPixelStyle(code!, "padding-left");
    const verticalSeparation =
      readPixelStyle(macSign!, "padding-bottom") +
      readPixelStyle(macSign!, "margin-bottom") +
      readPixelStyle(code!, "margin-top") +
      readPixelStyle(code!, "padding-top");

    expect(dotLeft).toBeLessThanOrEqual(codeLeft);
    expect(verticalSeparation).toBeGreaterThan(0);
  });
});
