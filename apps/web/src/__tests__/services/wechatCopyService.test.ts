import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  parserRender: vi.fn(),
  createMarkdownParserMock: vi.fn(),
  processHtmlMock: vi.fn(),
  clipboardWrite: vi.fn(),
  desktopClipboardWrite: vi.fn(),
  resolveInlineStyleVariablesForCopy: vi.fn((html: string) => html),
  applyLightRootVars: vi.fn(),
  renderMermaidBlocks: vi.fn(async (_container?: Element) => undefined),
  renderTableBlocks: vi.fn(
    async (_container?: Element, _wrap?: boolean) => undefined,
  ),
  tableWrapEnabled: false,
  materializeCounterPseudoContent: vi.fn((html: string) => html),
  stripCounterPseudoRules: vi.fn((css: string) => css),
}));

vi.mock("react-hot-toast", () => ({
  default: {
    success: mocked.toastSuccess,
    error: mocked.toastError,
  },
}));

vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn(),
  },
}));

vi.mock("@wemd/core", () => ({
  createMarkdownParser: mocked.createMarkdownParserMock.mockImplementation(
    () => ({
      render: mocked.parserRender,
    }),
  ),
  processHtml: mocked.processHtmlMock,
}));

vi.mock("../../utils/mathJaxLoader", () => ({
  loadMathJax: vi.fn(),
}));

vi.mock("../../utils/linkFootnote", () => ({
  convertLinksToFootnotes: (html: string) => html,
}));

vi.mock("../../store/publishingPreferences", () => ({
  getPublishingPreference: (preference: string) =>
    preference === "tableWrap" && mocked.tableWrapEnabled,
}));

vi.mock("../../services/inlineStyleVarResolver", () => ({
  resolveInlineStyleVariablesForCopy: mocked.resolveInlineStyleVariablesForCopy,
  applyLightRootVars: mocked.applyLightRootVars,
}));

vi.mock("../../services/wechatCounterCompat", () => ({
  materializeCounterPseudoContent: mocked.materializeCounterPseudoContent,
  stripCounterPseudoRules: mocked.stripCounterPseudoRules,
}));

vi.mock("../../utils/mermaidConfig", () => ({
  getMermaidConfig: () => ({}),
  getThemedMermaidDiagram: (input: string) => input,
}));

vi.mock("../../services/wechatMermaidRenderer", () => ({
  renderMermaidBlocks: mocked.renderMermaidBlocks,
}));

vi.mock("../../services/wechatTableRenderer", () => ({
  renderTableBlocks: mocked.renderTableBlocks,
}));

vi.mock("../../store/themeStore", () => ({
  useThemeStore: {
    getState: () => ({
      themeId: "default",
      customThemes: [],
      getAllThemes: () => [],
    }),
  },
}));

import { copyToWechat } from "../../services/wechatCopyService";

const MAC_BAR_HTML =
  '<section id="wemd"><pre class="custom"><span class="mac-sign" aria-hidden="true" style="display:block;height:13px;padding:10px 14px 0;line-height:0;"><span class="mac-dot" style="display:inline-block;width:10px;height:10px;margin-top:1.5px;margin-right:7.5px;border-radius:50%;background:rgb(237,108,96);"></span><span class="mac-dot" style="display:inline-block;width:10px;height:10px;margin-top:1.5px;margin-right:7.5px;border-radius:50%;background:rgb(247,193,81);"></span><span class="mac-dot" style="display:inline-block;width:10px;height:10px;margin-top:1.5px;border-radius:50%;background:rgb(100,200,86);"></span></span><code class="hljs">const a = 1;</code></pre></section>';

const MAC_BAR_HTML_WITHOUT_METRICS =
  '<section id="wemd"><pre class="custom"><span class="mac-sign" aria-hidden="true"><span class="mac-dot"></span><span class="mac-dot"></span><span class="mac-dot"></span></span><code class="hljs">const a = 1;</code></pre></section>';

type MockClipboardItemData = Record<
  string,
  string | Blob | PromiseLike<string | Blob>
>;

class MockClipboardItem {
  static supports(_type: string): boolean {
    return true;
  }

  readonly types: string[];
  readonly presentationStyle: PresentationStyle;

  constructor(
    private readonly data: MockClipboardItemData,
    _options?: ClipboardItemOptions,
  ) {
    this.types = Object.keys(data);
    this.presentationStyle = "unspecified";
  }

  async getType(type: string): Promise<Blob> {
    const value = this.data[type];
    if (!value) {
      throw new Error(`Clipboard item type not found: ${type}`);
    }
    const resolved = await value;
    return typeof resolved === "string" ? new Blob([resolved]) : resolved;
  }
}

const dispatchSuccessfulCopy = (): boolean => {
  const event = new Event("copy", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clipboardData", {
    configurable: true,
    value: { setData: vi.fn() },
  });
  document.dispatchEvent(event);
  return true;
};

describe("wechatCopyService clipboard strategy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.tableWrapEnabled = false;
    mocked.createMarkdownParserMock.mockImplementation(() => ({
      render: mocked.parserRender,
    }));

    mocked.parserRender.mockReturnValue("<p>段落A</p><p>段落B</p>");
    mocked.processHtmlMock.mockReturnValue(
      '<section id="wemd"><p style="margin-top:18px;margin-bottom:18px;">段落A</p><p style="margin-top:18px;margin-bottom:18px;">段落B</p></section>',
    );

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        write: mocked.clipboardWrite,
      },
    });

    (
      window as unknown as { ClipboardItem: typeof ClipboardItem }
    ).ClipboardItem = MockClipboardItem as unknown as typeof ClipboardItem;
    (
      globalThis as unknown as { ClipboardItem: typeof ClipboardItem }
    ).ClipboardItem = (
      window as unknown as { ClipboardItem: typeof ClipboardItem }
    ).ClipboardItem;

    const doc = document as unknown as {
      execCommand?: (command: string) => boolean;
    };
    if (!doc.execCommand) {
      doc.execCommand = () => true;
    }

    Object.defineProperty(window, "wemdDesktop", {
      configurable: true,
      value: undefined,
    });
  });

  it("prefers native execCommand copy", async () => {
    const execSpy = vi
      .spyOn(document, "execCommand")
      .mockImplementation(dispatchSuccessfulCopy);

    await copyToWechat("test", "#wemd p { margin: 18px 0; }");

    expect(execSpy).toHaveBeenCalledWith("copy");
    expect(mocked.clipboardWrite).not.toHaveBeenCalled();
    expect(mocked.toastSuccess).toHaveBeenCalled();
    expect(mocked.toastError).not.toHaveBeenCalled();
  });

  it("复制成功提示不使用 emoji 图标", async () => {
    vi.spyOn(document, "execCommand").mockImplementation(
      dispatchSuccessfulCopy,
    );

    await copyToWechat("test", "#wemd p { margin: 18px 0; }");

    expect(mocked.toastSuccess).toHaveBeenCalledTimes(1);
    const [, options] = mocked.toastSuccess.mock.calls[0];
    expect(options).not.toHaveProperty("icon");
  });

  it("复制到公众号时使用当前表格自动换行偏好", async () => {
    mocked.tableWrapEnabled = true;

    await copyToWechat("test", "#wemd table { width: 100%; }");

    expect(mocked.renderTableBlocks).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      true,
    );
  });

  it("prefers desktop clipboard bridge in desktop runtime", async () => {
    Object.defineProperty(window, "wemdDesktop", {
      configurable: true,
      value: {
        platform: "darwin",
        clipboard: {
          writeHTML: mocked.desktopClipboardWrite.mockResolvedValue({
            success: true,
          }),
        },
      },
    });
    const execSpy = vi
      .spyOn(document, "execCommand")
      .mockImplementation(dispatchSuccessfulCopy);

    await copyToWechat("test", "#wemd p { margin: 18px 0; }");

    expect(mocked.desktopClipboardWrite).toHaveBeenCalledTimes(1);
    expect(execSpy).not.toHaveBeenCalled();
    expect(mocked.clipboardWrite).not.toHaveBeenCalled();
    expect(mocked.toastSuccess).toHaveBeenCalled();
    expect(mocked.toastError).not.toHaveBeenCalled();
  });

  it("prefers native execCommand in desktop win32 runtime", async () => {
    Object.defineProperty(window, "wemdDesktop", {
      configurable: true,
      value: {
        platform: "win32",
        clipboard: {
          writeHTML: mocked.desktopClipboardWrite.mockResolvedValue({
            success: true,
          }),
        },
      },
    });
    const execSpy = vi
      .spyOn(document, "execCommand")
      .mockImplementation(dispatchSuccessfulCopy);

    await copyToWechat("test", "#wemd p { margin: 18px 0; }");

    expect(execSpy).toHaveBeenCalledWith("copy");
    expect(mocked.desktopClipboardWrite).not.toHaveBeenCalled();
    expect(mocked.clipboardWrite).not.toHaveBeenCalled();
    expect(mocked.toastSuccess).toHaveBeenCalled();
    expect(mocked.toastError).not.toHaveBeenCalled();
  });

  it("falls back to native execCommand when desktop bridge returns failure", async () => {
    Object.defineProperty(window, "wemdDesktop", {
      configurable: true,
      value: {
        platform: "darwin",
        clipboard: {
          writeHTML: mocked.desktopClipboardWrite.mockResolvedValue({
            success: false,
            error: "bridge failed",
          }),
        },
      },
    });
    const execSpy = vi
      .spyOn(document, "execCommand")
      .mockImplementation(dispatchSuccessfulCopy);

    await copyToWechat("test", "#wemd p { margin: 18px 0; }");

    expect(mocked.desktopClipboardWrite).toHaveBeenCalledTimes(1);
    expect(execSpy).toHaveBeenCalledWith("copy");
    expect(mocked.clipboardWrite).not.toHaveBeenCalled();
    expect(mocked.toastSuccess).toHaveBeenCalled();
    expect(mocked.toastError).not.toHaveBeenCalled();
  });

  it("falls back to Clipboard API when desktop bridge and execCommand both fail", async () => {
    Object.defineProperty(window, "wemdDesktop", {
      configurable: true,
      value: {
        platform: "darwin",
        clipboard: {
          writeHTML: mocked.desktopClipboardWrite.mockResolvedValue({
            success: false,
            error: "bridge failed",
          }),
        },
      },
    });
    const execSpy = vi.spyOn(document, "execCommand").mockReturnValue(false);

    await copyToWechat("test", "#wemd p { margin: 18px 0; }");

    expect(mocked.desktopClipboardWrite).toHaveBeenCalledTimes(1);
    expect(execSpy).toHaveBeenCalledWith("copy");
    expect(mocked.clipboardWrite).toHaveBeenCalledTimes(1);
    expect(mocked.toastSuccess).toHaveBeenCalled();
    expect(mocked.toastError).not.toHaveBeenCalled();
  });

  it("falls back to desktop bridge when win32 execCommand fails", async () => {
    Object.defineProperty(window, "wemdDesktop", {
      configurable: true,
      value: {
        platform: "win32",
        clipboard: {
          writeHTML: mocked.desktopClipboardWrite.mockResolvedValue({
            success: true,
          }),
        },
      },
    });
    const execSpy = vi.spyOn(document, "execCommand").mockReturnValue(false);

    await copyToWechat("test", "#wemd p { margin: 18px 0; }");

    expect(execSpy).toHaveBeenCalledWith("copy");
    expect(mocked.desktopClipboardWrite).toHaveBeenCalledTimes(1);
    expect(mocked.clipboardWrite).not.toHaveBeenCalled();
    expect(mocked.toastSuccess).toHaveBeenCalled();
    expect(mocked.toastError).not.toHaveBeenCalled();
  });

  it("falls back to Clipboard API when native execCommand fails", async () => {
    const execSpy = vi.spyOn(document, "execCommand").mockReturnValue(false);

    await copyToWechat("test", "#wemd p { margin: 18px 0; }");

    expect(execSpy).toHaveBeenCalledWith("copy");
    expect(mocked.clipboardWrite).toHaveBeenCalledTimes(1);
    expect(mocked.toastSuccess).toHaveBeenCalled();
    expect(mocked.toastError).not.toHaveBeenCalled();
  });

  it("uses rendered plain text instead of raw markdown in Clipboard fallback", async () => {
    vi.spyOn(document, "execCommand").mockReturnValue(false);

    await copyToWechat("# 标题", "#wemd p { margin: 18px 0; }");

    expect(mocked.clipboardWrite).toHaveBeenCalledTimes(1);
    const [[items]] = mocked.clipboardWrite.mock.calls;
    const clipboardItem = items[0] as MockClipboardItem;
    const plainBlob = await clipboardItem.getType("text/plain");
    const htmlBlob = await clipboardItem.getType("text/html");
    const expectedRenderedPlainText = "段落A段落B";

    expect(plainBlob).toBeTruthy();
    expect(htmlBlob).toBeTruthy();
    expect(plainBlob.size).toBe(new Blob([expectedRenderedPlainText]).size);
    expect(plainBlob.size).not.toBe(new Blob(["# 标题"]).size);
    expect(htmlBlob.size).toBeGreaterThan(plainBlob.size);
  });

  it("normalizes text color for nodes inserted by mermaid renderer", async () => {
    mocked.renderMermaidBlocks.mockImplementationOnce(
      async (container?: Element) => {
        if (!container) return;
        const root = container.firstElementChild as HTMLElement | null;
        if (!root) return;
        const paragraph = document.createElement("p");
        paragraph.textContent = "Mermaid 文本";
        root.appendChild(paragraph);
      },
    );

    Object.defineProperty(window, "wemdDesktop", {
      configurable: true,
      value: {
        platform: "darwin",
        clipboard: {
          writeHTML: mocked.desktopClipboardWrite.mockResolvedValue({
            success: true,
          }),
        },
      },
    });

    await copyToWechat("test", "#wemd p { margin: 18px 0; }");

    expect(mocked.desktopClipboardWrite).toHaveBeenCalledTimes(1);
    const [payload] = mocked.desktopClipboardWrite.mock.calls[0] as [
      { html: string; text: string },
    ];
    const snapshot = document.createElement("div");
    snapshot.innerHTML = payload.html;

    const mermaidParagraph = Array.from(snapshot.querySelectorAll("p")).find(
      (node) => node.textContent?.trim() === "Mermaid 文本",
    ) as HTMLElement | undefined;

    expect(mermaidParagraph).toBeTruthy();
    expect(mermaidParagraph?.style.color).toBe("rgb(26, 26, 26)");
  });

  it("复制时将 Mac Bar 圆点转换为公众号可保留的清晰远程图片", async () => {
    mocked.processHtmlMock.mockReturnValue(MAC_BAR_HTML);

    Object.defineProperty(window, "wemdDesktop", {
      configurable: true,
      value: {
        platform: "darwin",
        clipboard: {
          writeHTML: mocked.desktopClipboardWrite.mockResolvedValue({
            success: true,
          }),
        },
      },
    });

    await copyToWechat(
      "test",
      "#wemd pre.custom > .mac-sign { display: block; }",
      { showMacBar: true },
    );

    expect(mocked.createMarkdownParserMock).toHaveBeenCalledWith({
      mathRenderer: "katex",
      showMacBar: true,
    });
    const [payload] = mocked.desktopClipboardWrite.mock.calls[0] as [
      { html: string; text: string },
    ];
    const snapshot = document.createElement("div");
    snapshot.innerHTML = payload.html;
    const image = snapshot.querySelector(
      ".mac-sign > img",
    ) as HTMLImageElement | null;

    expect(image).toBeTruthy();
    expect(image?.src).toBe("https://img.wemd.app/1785143461387_dwk0yi.svg");
    expect(image?.style.width).toBe("45px");
    expect(image?.style.height).toBe("13px");
    expect(image?.style.getPropertyPriority("width")).toBe("important");
    expect(image?.style.getPropertyPriority("height")).toBe("important");
    expect(image?.style.maxWidth).toBe("45px");
    expect(image?.style.maxHeight).toBe("13px");
    expect(snapshot.querySelector(".mac-dot")).toBeNull();
    expect(payload.html).not.toContain("data:image/png");
    expect(payload.html).not.toContain("<svg");
  });

  it("Mac Bar 圆点尺寸无法推导时保留 HTML 圆点并继续复制", async () => {
    mocked.processHtmlMock.mockReturnValue(MAC_BAR_HTML_WITHOUT_METRICS);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    Object.defineProperty(window, "wemdDesktop", {
      configurable: true,
      value: {
        platform: "darwin",
        clipboard: {
          writeHTML: mocked.desktopClipboardWrite.mockResolvedValue({
            success: true,
          }),
        },
      },
    });

    await copyToWechat("test", "", { showMacBar: true });

    expect(mocked.desktopClipboardWrite).toHaveBeenCalledTimes(1);
    const [payload] = mocked.desktopClipboardWrite.mock.calls[0] as [
      { html: string; text: string },
    ];
    expect(payload.html.match(/class="mac-dot"/g)).toHaveLength(3);
    expect(payload.html).not.toContain("<img");
    expect(warnSpy).toHaveBeenCalledWith(
      "Mac Bar 圆点尺寸推导失败，保留 HTML 圆点",
      expect.objectContaining({ width: Number.NaN }),
    );
  });
});
