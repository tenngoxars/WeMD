import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  parserRender: vi.fn(),
  processHtml: vi.fn(),
  clipboardWrite: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
  default: {
    success: mocked.toastSuccess,
    error: mocked.toastError,
  },
}));

vi.mock("@wemd/core", () => ({
  createMarkdownParser: () => ({ render: mocked.parserRender }),
  processHtml: mocked.processHtml,
}));

vi.mock("../../utils/linkFootnote", () => ({
  convertLinksToFootnotes: (html: string) => html,
}));

vi.mock("../../store/publishingPreferences", () => ({
  getPublishingPreference: () => false,
}));

vi.mock("../../services/inlineStyleVarResolver", () => ({
  applyLightRootVars: vi.fn(),
  resolveInlineStyleVariablesForCopy: (html: string) => html,
}));

vi.mock("../../services/wechatCounterCompat", () => ({
  materializeCounterPseudoContent: (html: string) => html,
  stripCounterPseudoRules: (css: string) => css,
}));

vi.mock("../../services/wechatMathCompat", () => ({
  renderHighRiskMathAsImages: vi.fn(async () => ({ imageCount: 0 })),
  stripHiddenMathMarkupForWechat: vi.fn(),
}));

vi.mock("../../services/wechatMermaidRenderer", () => ({
  renderMermaidBlocks: vi.fn(async () => undefined),
}));

vi.mock("../../services/wechatTableRenderer", () => ({
  renderTableBlocks: vi.fn(async () => undefined),
}));

import {
  copyToWechat,
  normalizeCopyContainer,
} from "../../services/wechatCopyService";

type ClipboardDataStub = Pick<DataTransfer, "setData">;

const BACKGROUND_HTML = `
  <section id="wemd" style="background-image: repeating-linear-gradient(45deg, rgba(0, 0, 0, 0.08) 0 1px, transparent 1px 12px); background-size: 12px 12px;">
    <h1><span class="content">标题</span></h1>
    <p>正文 <strong>加粗</strong> <a href="https://example.com">链接</a></p>
    <blockquote><p>引用</p></blockquote>
    <pre><code>const answer = 42;</code></pre>
    <table><tbody><tr><td>单元格</td></tr></tbody></table>
    <figure class="mermaid"><img src="https://example.com/diagram.png" alt="流程图" /></figure>
  </section>
`;

const PLAIN_IMAGE_HTML = `
  <section id="wemd" style="color: rgb(34, 34, 34);">
    <figure style="display: flex; margin: 0;"><img src="https://example.com/image.png" alt="示例图" style="display: block; margin: 0 0 24px;" /></figure><p style="margin: 16px 0 0;">图片下方正文</p>
  </section>
`;

const MAC_BAR_BACKGROUND_HTML = `
  <section id="wemd" style="background-image: repeating-linear-gradient(45deg, rgba(0, 0, 0, 0.08) 0 1px, transparent 1px 12px); background-size: 12px 12px;">
    <pre class="custom" style="padding: 0; background: rgb(31, 41, 55); overflow: hidden;"><span class="mac-sign" aria-hidden="true" style="display: block; height: 13px; padding: 10px 14px 0; line-height: 0;"><span class="mac-dot" style="display: inline-block; width: 10px; height: 10px; margin-top: 1.5px; margin-right: 7.5px; border-radius: 50%; background: rgb(237, 108, 96);"></span><span class="mac-dot" style="display: inline-block; width: 10px; height: 10px; margin-top: 1.5px; margin-right: 7.5px; border-radius: 50%; background: rgb(247, 193, 81);"></span><span class="mac-dot" style="display: inline-block; width: 10px; height: 10px; margin-top: 1.5px; border-radius: 50%; background: rgb(100, 200, 86);"></span></span><code class="hljs" style="display: block; margin: 0; padding: 16px;">const background = 'section';</code></pre>
    <pre class="plain-control" style="padding: 14px;"><code>普通代码块</code></pre>
  </section>
`;

const readPixelStyle = (element: HTMLElement, property: string): number =>
  Number.parseFloat(element.style.getPropertyValue(property)) || 0;

const dispatchCopyEvent = (clipboardData: ClipboardDataStub): Event => {
  const event = new Event("copy", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clipboardData", {
    configurable: true,
    value: clipboardData,
  });
  document.dispatchEvent(event);
  return event;
};

const getExpectedNormalizedHtml = (): string => {
  const container = document.createElement("div");
  container.innerHTML = BACKGROUND_HTML;
  normalizeCopyContainer(container);
  return container.innerHTML;
};

const readBlobText = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result ?? "")));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsText(blob);
  });

describe("wechatCopyService 原生剪贴板传输", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.parserRender.mockReturnValue("<p>test</p>");
    mocked.processHtml.mockReturnValue(BACKGROUND_HTML);

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { write: mocked.clipboardWrite.mockResolvedValue(undefined) },
    });
    Object.defineProperty(window, "ClipboardItem", {
      configurable: true,
      value: class ClipboardItemStub {
        constructor(readonly data: Record<string, Blob>) {}
      },
    });
    Object.defineProperty(window, "wemdDesktop", {
      configurable: true,
      value: undefined,
    });

    const documentWithExecCommand = document as Document & {
      execCommand?: (command: string) => boolean;
    };
    if (!documentWithExecCommand.execCommand) {
      documentWithExecCommand.execCommand = () => false;
    }
  });

  afterEach(() => {
    document.body.replaceChildren();
    window.getSelection()?.removeAllRanges();
    vi.restoreAllMocks();
  });

  it("普通主题使用浏览器原生选区序列化，避免 strict 根容器触发公众号图片空行", async () => {
    mocked.processHtml.mockReturnValue(PLAIN_IMAGE_HTML);
    const setData = vi.fn();
    let copyEvent: Event | undefined;
    let selectedText = "";
    const selectedFragments: DocumentFragment[] = [];
    vi.spyOn(document, "execCommand").mockImplementation(() => {
      const selection = window.getSelection();
      selectedText = selection?.toString() ?? "";
      if (selection && selection.rangeCount > 0) {
        selectedFragments.push(selection.getRangeAt(0).cloneContents());
      }
      copyEvent = dispatchCopyEvent({ setData } as ClipboardDataStub);
      return true;
    });

    await copyToWechat("test", "#wemd { color: #222; }");

    expect(setData).not.toHaveBeenCalled();
    expect(copyEvent?.defaultPrevented).toBe(false);
    expect(selectedText).toContain("图片下方正文");
    expect(selectedFragments).toHaveLength(1);
    const selectedFigure = selectedFragments[0].querySelector("figure");
    expect(selectedFigure?.firstElementChild?.tagName).toBe("IMG");
    expect(selectedFigure?.nextElementSibling?.tagName).toBe("P");
    expect(mocked.clipboardWrite).not.toHaveBeenCalled();
    expect(mocked.toastSuccess).toHaveBeenCalledTimes(1);
  });

  it("普通主题未触发原生 copy 事件时进入 Clipboard API 回退", async () => {
    mocked.processHtml.mockReturnValue(PLAIN_IMAGE_HTML);
    vi.spyOn(document, "execCommand").mockReturnValue(true);

    await copyToWechat("test", "#wemd { color: #222; }");

    expect(mocked.clipboardWrite).toHaveBeenCalledTimes(1);
    const [[items]] = mocked.clipboardWrite.mock.calls;
    const clipboardItem = items[0] as { data: Record<string, Blob> };
    expect(await readBlobText(clipboardItem.data["text/html"])).toContain(
      "图片下方正文",
    );
  });

  it("execCommand 返回 true 但 copy 事件未写入时继续 fallback", async () => {
    vi.spyOn(document, "execCommand").mockReturnValue(true);

    await copyToWechat("test", "#wemd { color: #222; }");

    expect(mocked.clipboardWrite).toHaveBeenCalledTimes(1);
    const [[items]] = mocked.clipboardWrite.mock.calls;
    const clipboardItem = items[0] as { data: Record<string, Blob> };
    expect(await readBlobText(clipboardItem.data["text/html"])).toBe(
      getExpectedNormalizedHtml(),
    );
    expect(await readBlobText(clipboardItem.data["text/plain"])).toContain(
      "标题",
    );
    expect(mocked.toastSuccess).toHaveBeenCalledTimes(1);
  });

  it("copy 事件缺少 clipboardData 时继续 fallback", async () => {
    vi.spyOn(document, "execCommand").mockImplementation(() => {
      document.dispatchEvent(
        new Event("copy", { bubbles: true, cancelable: true }),
      );
      return true;
    });

    await copyToWechat("test", "#wemd { color: #222; }");

    expect(mocked.clipboardWrite).toHaveBeenCalledTimes(1);
  });

  it("通过 copy 事件写入完整背景与原有内容，不受 execCommand 返回值影响", async () => {
    const expectedHtml = getExpectedNormalizedHtml();
    const written = new Map<string, string>();
    let copyEvent: Event | undefined;
    const setData = vi.fn((type: string, value: string) => {
      written.set(type, value);
    });
    vi.spyOn(document, "execCommand").mockImplementation(() => {
      copyEvent = dispatchCopyEvent({ setData } as ClipboardDataStub);
      return false;
    });

    await copyToWechat("test", "#wemd { color: #222; }");

    expect(setData).toHaveBeenCalledTimes(2);
    expect(copyEvent?.defaultPrevented).toBe(true);
    expect(mocked.clipboardWrite).not.toHaveBeenCalled();

    const html = written.get("text/html");
    const text = written.get("text/plain");
    expect(html).toBe(expectedHtml);
    expect(text).toContain("标题");

    const snapshot = document.createElement("div");
    snapshot.innerHTML = html!;
    const root = snapshot.firstElementChild as HTMLElement | null;
    expect(root?.tagName).toBe("SECTION");
    expect(root?.id).toBe("");
    expect(root?.style.backgroundImage).toContain("repeating-linear-gradient");
    expect(root?.style.backgroundSize).toBe("12px 12px");
    expect(snapshot.querySelector("h1 .content")?.textContent).toBe("标题");
    expect(snapshot.querySelector("a")?.getAttribute("href")).toBe(
      "https://example.com",
    );
    expect(snapshot.querySelector("pre code")?.textContent).toBe(
      "const answer = 42;",
    );
    expect(snapshot.querySelector("table td")?.textContent).toBe("单元格");
    expect(
      snapshot.querySelector("figure.mermaid img")?.getAttribute("alt"),
    ).toBe("流程图");

    dispatchCopyEvent({ setData } as ClipboardDataStub);
    expect(setData).toHaveBeenCalledTimes(2);
  });

  it("带背景文章的 Mac Bar 独占顶部栏且不晚于正文起点", async () => {
    mocked.processHtml.mockReturnValue(MAC_BAR_BACKGROUND_HTML);
    const written = new Map<string, string>();
    vi.spyOn(document, "execCommand").mockImplementation(() => {
      dispatchCopyEvent({
        setData: (type: string, value: string) => written.set(type, value),
      } as ClipboardDataStub);
      return true;
    });

    await copyToWechat("test", "#wemd { color: #222; }", {
      showMacBar: true,
    });

    const snapshot = document.createElement("div");
    snapshot.innerHTML = written.get("text/html") ?? "";
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
    expect(root?.style.backgroundImage).toContain("repeating-linear-gradient");
    expect(image).toBeTruthy();
    expect(macSign?.nextElementSibling).toBe(code);
    expect(snapshot.querySelector(".mac-dot")).toBeNull();
    expect(plainPre?.style.padding).toBe("14px");
    expect(pre?.style.padding).toBe("0px");
    expect(macSign?.style.paddingTop).toBe("10px");
    expect(macSign?.style.paddingRight).toBe("14px");
    expect(macSign?.style.paddingBottom).toBe("0px");
    expect(macSign?.style.paddingLeft).toBe("14px");
    expect(code?.style.padding).toBe("16px");

    const dotLeft =
      readPixelStyle(pre!, "padding-left") +
      readPixelStyle(macSign!, "margin-left") +
      readPixelStyle(macSign!, "padding-left") +
      readPixelStyle(image!, "margin-left");
    const codeLeft =
      readPixelStyle(pre!, "padding-left") +
      readPixelStyle(code!, "margin-left") +
      readPixelStyle(code!, "padding-left");
    const verticalSeparation =
      readPixelStyle(macSign!, "padding-bottom") +
      readPixelStyle(macSign!, "margin-bottom") +
      readPixelStyle(code!, "margin-top") +
      readPixelStyle(code!, "padding-top");
    const nestedTopInset =
      readPixelStyle(pre!, "padding-top") +
      readPixelStyle(macSign!, "padding-top");
    const largestSingleTopInset = Math.max(
      readPixelStyle(pre!, "padding-top"),
      readPixelStyle(macSign!, "padding-top"),
      readPixelStyle(code!, "padding-top"),
    );

    expect.soft(dotLeft).toBeLessThanOrEqual(codeLeft);
    expect.soft(nestedTopInset).toBeLessThanOrEqual(largestSingleTopInset);
    expect.soft(verticalSeparation).toBeGreaterThan(0);
    expect.soft(code?.style.display).toBe("block");
  });

  it("copy 事件只完成部分写入时继续 fallback", async () => {
    let copyEvent: Event | undefined;
    const setData = vi.fn((type: string) => {
      if (type === "text/plain") {
        throw new Error("plain text write failed");
      }
    });
    vi.spyOn(document, "execCommand").mockImplementation(() => {
      copyEvent = dispatchCopyEvent({ setData } as ClipboardDataStub);
      return true;
    });

    await copyToWechat("test", "#wemd { color: #222; }");

    expect(mocked.clipboardWrite).toHaveBeenCalledTimes(1);
    expect(copyEvent?.defaultPrevented).toBe(false);
    expect(mocked.toastSuccess).toHaveBeenCalledTimes(1);
  });

  it("execCommand 抛错时清理 listener 并继续 fallback", async () => {
    vi.spyOn(document, "execCommand").mockImplementation(() => {
      throw new Error("copy command failed");
    });

    await copyToWechat("test", "#wemd { color: #222; }");

    expect(mocked.clipboardWrite).toHaveBeenCalledTimes(1);
    const setData = vi.fn();
    dispatchCopyEvent({ setData } as ClipboardDataStub);
    expect(setData).not.toHaveBeenCalled();
  });

  it("临时 Selection 设置失败时恢复原选区并继续 fallback", async () => {
    const source = document.createElement("p");
    source.textContent = "用户原选区";
    document.body.append(source);
    const selection = window.getSelection()!;
    const originalRange = document.createRange();
    originalRange.selectNodeContents(source);
    selection.removeAllRanges();
    selection.addRange(originalRange);
    const nativeAddRange = selection.addRange.bind(selection);
    vi.spyOn(selection, "addRange")
      .mockImplementationOnce(() => {
        throw new Error("selection unavailable");
      })
      .mockImplementation(nativeAddRange);

    await copyToWechat("test", "#wemd { color: #222; }");

    expect(mocked.clipboardWrite).toHaveBeenCalledTimes(1);
    expect(window.getSelection()?.toString()).toBe("用户原选区");
  });

  it("复制结束后恢复原焦点与 Selection", async () => {
    const input = document.createElement("input");
    input.value = "输入框原选区";
    const source = document.createElement("p");
    source.textContent = "用户原选区";
    const temporaryFocusTarget = document.createElement("button");
    document.body.append(input, source, temporaryFocusTarget);
    input.focus();
    input.setSelectionRange(1, 5, "backward");
    const originalRange = document.createRange();
    originalRange.selectNodeContents(source);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(originalRange);

    vi.spyOn(document, "execCommand").mockImplementation(() => {
      dispatchCopyEvent({ setData: vi.fn() } as ClipboardDataStub);
      temporaryFocusTarget.focus();
      return true;
    });

    await copyToWechat("test", "#wemd { color: #222; }");

    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(1);
    expect(input.selectionEnd).toBe(5);
    expect(input.selectionDirection).toBe("backward");
    expect(window.getSelection()?.toString()).toBe("用户原选区");
  });
});
