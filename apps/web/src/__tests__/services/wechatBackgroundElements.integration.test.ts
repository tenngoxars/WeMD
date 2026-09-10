import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  clipboardWrite: vi.fn(),
  getSiteConfig: vi.fn(),
  initialize: vi.fn(),
  mermaidRender: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("mermaid", () => ({
  default: {
    initialize: mocked.initialize,
    mermaidAPI: { getSiteConfig: mocked.getSiteConfig },
    render: mocked.mermaidRender,
  },
}));

vi.mock("../../store/themeStore", () => ({
  useThemeStore: {
    getState: () => ({
      customThemes: [],
      getAllThemes: () => [],
      themeId: "default",
    }),
  },
}));

vi.mock("../../utils/mermaidConfig", () => ({
  getMermaidConfig: () => ({
    flowchart: { htmlLabels: false },
    theme: "base",
    themeVariables: { fontFamily: "system-ui" },
  }),
  getThemedMermaidDiagram: (diagram: string) => diagram,
}));

vi.mock("../../utils/mathJaxLoader", () => ({
  loadMathJax: vi.fn(async () => ({})),
}));

import { copyToWechat } from "../../services/wechatCopyService";

const MARKDOWN = `
# 综合背景文章

普通段落包含 **加粗**、*斜体*、\`行内代码\` 和 [链接](https://wemd.app)。

![示例图片](https://img.example.com/example.png)

> 普通引用

> [!NOTE]
> 提示内容

- 列表一
- 列表二

| 项目 | 结果 |
| --- | --- |
| 背景 | 保留 |

\`\`\`js
const background = "section";
console.log(background);
\`\`\`

行内公式：$x$。

\`\`\`mermaid
graph TD
  A --> B
\`\`\`

---
`;

const CSS = `
  #wemd {
    /* 页面变量；注释含分号 */
    --wemd-page-padding: 18px;
    --wemd-grid-color: rgba(217, 119, 6, 0.2);
    padding: 24px var(--wemd-page-padding);
    color: #1f2937;
    background-color: #fffaf0;
    background-image:
      linear-gradient(90deg, var(--wemd-grid-color) 1px, transparent 1px),
      linear-gradient(0deg, var(--wemd-grid-color) 1px, transparent 1px);
    background-size: 20px 20px;
    background-repeat: repeat;
  }
  #wemd blockquote,
  #wemd .callout { background-color: rgba(255, 255, 255, 0.86); }
  #wemd table { border-collapse: collapse; }
  #wemd th,
  #wemd td { border: 1px solid #fb923c; }
  #wemd pre { color: #f8fafc; background-color: #1f2937; }
  #wemd pre.custom { padding: 0; overflow: hidden; }
  #wemd pre.custom > .mac-sign { display: block; }
  #wemd pre code { display: block; padding: 16px; }
`;

describe("公众号背景文章综合元素复制", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.getSiteConfig.mockReturnValue({
      flowchart: { htmlLabels: true },
      startOnLoad: false,
    });
    mocked.mermaidRender.mockResolvedValue({
      svg: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60"><text x="10" y="30">A → B</text></svg>',
    });

    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: vi.fn(() => null),
        removeItem: vi.fn(),
        setItem: vi.fn(),
      },
    });
    Object.defineProperty(window, "electron", {
      configurable: true,
      value: {
        clipboard: {
          writeHTML: mocked.clipboardWrite.mockResolvedValue({ success: true }),
        },
        isElectron: true,
        platform: "darwin",
      },
    });

    Object.defineProperty(window, "MathJax", {
      configurable: true,
      value: {
        texReset: vi.fn(),
        tex2svg: vi.fn(() => {
          const wrapper = document.createElement("div");
          wrapper.innerHTML =
            '<svg width="1ex" height="1ex" viewBox="0 0 10 10"><path d="M0 0h10v10H0z"></path></svg>';
          return wrapper;
        }),
      },
    });

    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mermaid");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      function getContextMock(this: HTMLCanvasElement) {
        return {
          canvas: this,
          drawImage: vi.fn(),
          fillRect: vi.fn(),
          fillStyle: "#ffffff",
          fillText: vi.fn(),
          font: "",
          restore: vi.fn(),
          save: vi.fn(),
          scale: vi.fn(),
          textAlign: "center",
          textBaseline: "alphabetic",
        } as unknown as CanvasRenderingContext2D;
      },
    );
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
      "data:image/png;base64,mermaid",
    );

    class LoadedImage {
      crossOrigin = "";
      onerror: null | (() => void) = null;
      onload: null | (() => void) = null;

      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    }

    vi.stubGlobal("Image", LoadedImage);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    Object.defineProperty(window, "electron", {
      configurable: true,
      value: undefined,
    });
  });

  it("在同一根背景画布中保留全部关键元素及其兼容转换", async () => {
    await copyToWechat(MARKDOWN, CSS, { showMacBar: true });

    expect(mocked.clipboardWrite).toHaveBeenCalledTimes(1);
    const [payload] = mocked.clipboardWrite.mock.calls[0] as [
      { html: string; text: string },
    ];
    const snapshot = document.createElement("div");
    snapshot.innerHTML = payload.html;
    const root = snapshot.firstElementChild as HTMLElement;

    expect(root.tagName).toBe("SECTION");
    expect(root.style.backgroundImage.match(/linear-gradient/g)).toHaveLength(
      2,
    );
    expect(root.style.backgroundSize).toBe("20px 20px");
    expect(payload.html).not.toMatch(/--[\w-]+\s*:/);

    expect(root.querySelector("h1")?.textContent).toContain("综合背景文章");
    expect(root.querySelector("strong")?.textContent).toBe("加粗");
    expect(root.querySelector("em")?.textContent).toBe("斜体");
    expect(root.querySelector("p code")?.textContent).toBe("行内代码");
    expect(root.querySelector("a")?.getAttribute("href")).toBe(
      "https://wemd.app",
    );
    expect(root.querySelector("img[alt='示例图片']")).toBeTruthy();
    expect(root.querySelector("blockquote")).toBeTruthy();
    expect(root.querySelector(".callout .callout-title")).toBeTruthy();
    expect(root.querySelectorAll("li")).toHaveLength(2);
    expect(root.querySelector("table td")?.textContent).toBe("背景");
    expect(root.querySelector("pre.custom > .mac-sign > img")).toBeTruthy();
    expect(root.querySelector("pre.custom > code")?.textContent).toContain(
      'const background = "section";',
    );
    expect(root.querySelector(".inline-equation svg")).toBeTruthy();
    expect(root.querySelector(".katex-html")).toBeNull();
    expect(root.querySelector(".katex-mathml")).toBeNull();
    expect(root.querySelector("pre.mermaid")).toBeNull();
    expect(
      root.querySelector("img[src='data:image/png;base64,mermaid']"),
    ).toBeTruthy();
    expect(root.querySelector("hr")).toBeTruthy();
  });
});
