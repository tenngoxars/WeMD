import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  parserRender: vi.fn(),
  processHtmlMock: vi.fn(),
  clipboardWrite: vi.fn(),
  electronClipboardWrite: vi.fn(),
  resolveInlineStyleVariablesForCopy: vi.fn((html: string) => html),
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
}));

vi.mock("../../services/wechatCounterCompat", () => ({
  materializeCounterPseudoContent: mocked.materializeCounterPseudoContent,
  stripCounterPseudoRules: mocked.stripCounterPseudoRules,
}));

vi.mock("../../utils/mermaidConfig", () => ({
  getMermaidConfig: () => ({}),
  getThemedMermaidDiagram: (input: string) => input,
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

import {
  copyToWechat,
  normalizeCopyContainer,
  stripCopyMetadata,
} from "../../services/wechatCopyService";

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
});
