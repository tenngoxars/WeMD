import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  parserRender: vi.fn(),
  processHtmlMock: vi.fn(),
  clipboardWrite: vi.fn(),
  electronClipboardWrite: vi.fn(),
  resolveInlineStyleVariablesForCopy: vi.fn((html: string) => html),
  applyLightRootVars: vi.fn(),
  renderMermaidBlocks: vi.fn(async (_container?: Element) => undefined),
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
  createMarkdownParser: () => ({
    render: mocked.parserRender,
  }),
  processHtml: mocked.processHtmlMock,
}));

vi.mock("../../utils/mathJaxLoader", () => ({
  loadMathJax: vi.fn(),
}));

vi.mock("../../utils/katexRenderer", () => ({
  hasMathFormula: vi.fn(() => false),
}));

vi.mock("../../utils/linkFootnote", () => ({
  convertLinksToFootnotes: (html: string) => html,
}));

vi.mock("../../components/Editor/ToolbarState", () => ({
  getLinkToFootnoteEnabled: () => false,
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

describe("wechatCopyService clipboard strategy", () => {
  beforeEach(() => {
    vi.clearAllMocks();

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

    Object.defineProperty(window, "electron", {
      configurable: true,
      value: undefined,
    });
  });

  it("prefers native execCommand copy", async () => {
    const execSpy = vi.spyOn(document, "execCommand").mockReturnValue(true);

    await copyToWechat("test", "#wemd p { margin: 18px 0; }");

    expect(execSpy).toHaveBeenCalledWith("copy");
    expect(mocked.clipboardWrite).not.toHaveBeenCalled();
    expect(mocked.toastSuccess).toHaveBeenCalled();
    expect(mocked.toastError).not.toHaveBeenCalled();
  });

  it("prefers electron clipboard bridge in electron runtime", async () => {
    Object.defineProperty(window, "electron", {
      configurable: true,
      value: {
        isElectron: true,
        platform: "darwin",
        clipboard: {
          writeHTML: mocked.electronClipboardWrite.mockResolvedValue({
            success: true,
          }),
        },
      },
    });
    const execSpy = vi.spyOn(document, "execCommand").mockReturnValue(true);

    await copyToWechat("test", "#wemd p { margin: 18px 0; }");

    expect(mocked.electronClipboardWrite).toHaveBeenCalledTimes(1);
    expect(execSpy).not.toHaveBeenCalled();
    expect(mocked.clipboardWrite).not.toHaveBeenCalled();
    expect(mocked.toastSuccess).toHaveBeenCalled();
    expect(mocked.toastError).not.toHaveBeenCalled();
  });

  it("prefers native execCommand in electron win32 runtime", async () => {
    Object.defineProperty(window, "electron", {
      configurable: true,
      value: {
        isElectron: true,
        platform: "win32",
        clipboard: {
          writeHTML: mocked.electronClipboardWrite.mockResolvedValue({
            success: true,
          }),
        },
      },
    });
    const execSpy = vi.spyOn(document, "execCommand").mockReturnValue(true);

    await copyToWechat("test", "#wemd p { margin: 18px 0; }");

    expect(execSpy).toHaveBeenCalledWith("copy");
    expect(mocked.electronClipboardWrite).not.toHaveBeenCalled();
    expect(mocked.clipboardWrite).not.toHaveBeenCalled();
    expect(mocked.toastSuccess).toHaveBeenCalled();
    expect(mocked.toastError).not.toHaveBeenCalled();
  });

  it("falls back to native execCommand when electron bridge returns failure", async () => {
    Object.defineProperty(window, "electron", {
      configurable: true,
      value: {
        isElectron: true,
        platform: "darwin",
        clipboard: {
          writeHTML: mocked.electronClipboardWrite.mockResolvedValue({
            success: false,
            error: "bridge failed",
          }),
        },
      },
    });
    const execSpy = vi.spyOn(document, "execCommand").mockReturnValue(true);

    await copyToWechat("test", "#wemd p { margin: 18px 0; }");

    expect(mocked.electronClipboardWrite).toHaveBeenCalledTimes(1);
    expect(execSpy).toHaveBeenCalledWith("copy");
    expect(mocked.clipboardWrite).not.toHaveBeenCalled();
    expect(mocked.toastSuccess).toHaveBeenCalled();
    expect(mocked.toastError).not.toHaveBeenCalled();
  });

  it("falls back to Clipboard API when electron bridge and execCommand both fail", async () => {
    Object.defineProperty(window, "electron", {
      configurable: true,
      value: {
        isElectron: true,
        platform: "darwin",
        clipboard: {
          writeHTML: mocked.electronClipboardWrite.mockResolvedValue({
            success: false,
            error: "bridge failed",
          }),
        },
      },
    });
    const execSpy = vi.spyOn(document, "execCommand").mockReturnValue(false);

    await copyToWechat("test", "#wemd p { margin: 18px 0; }");

    expect(mocked.electronClipboardWrite).toHaveBeenCalledTimes(1);
    expect(execSpy).toHaveBeenCalledWith("copy");
    expect(mocked.clipboardWrite).toHaveBeenCalledTimes(1);
    expect(mocked.toastSuccess).toHaveBeenCalled();
    expect(mocked.toastError).not.toHaveBeenCalled();
  });

  it("falls back to electron bridge when win32 execCommand fails", async () => {
    Object.defineProperty(window, "electron", {
      configurable: true,
      value: {
        isElectron: true,
        platform: "win32",
        clipboard: {
          writeHTML: mocked.electronClipboardWrite.mockResolvedValue({
            success: true,
          }),
        },
      },
    });
    const execSpy = vi.spyOn(document, "execCommand").mockReturnValue(false);

    await copyToWechat("test", "#wemd p { margin: 18px 0; }");

    expect(execSpy).toHaveBeenCalledWith("copy");
    expect(mocked.electronClipboardWrite).toHaveBeenCalledTimes(1);
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

    Object.defineProperty(window, "electron", {
      configurable: true,
      value: {
        isElectron: true,
        platform: "darwin",
        clipboard: {
          writeHTML: mocked.electronClipboardWrite.mockResolvedValue({
            success: true,
          }),
        },
      },
    });

    await copyToWechat("test", "#wemd p { margin: 18px 0; }");

    expect(mocked.electronClipboardWrite).toHaveBeenCalledTimes(1);
    const [payload] = mocked.electronClipboardWrite.mock.calls[0] as [
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
});
