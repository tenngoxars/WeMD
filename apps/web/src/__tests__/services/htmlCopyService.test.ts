import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  renderContainer: vi.fn(),
  desktopClipboardWriteText: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
  default: {
    success: mocked.toastSuccess,
    error: mocked.toastError,
  },
}));

vi.mock("../../services/wechatCopyService", () => ({
  renderWechatContainer: mocked.renderContainer,
}));

import { copyAsHtml } from "../../services/htmlCopyService";

const styledHtml =
  '<section id="wemd" style="color:red"><h1>Hello</h1></section>';

function stubContainer() {
  const container = document.createElement("div");
  container.innerHTML = styledHtml;
  mocked.renderContainer.mockResolvedValue({
    container,
    requiresExactHtmlTransport: false,
    mathFallback: { imageCount: 0, fallbackCount: 0 },
  });
}

function stubClipboard(writeText: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
}

describe("copyAsHtml", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubContainer();
    Object.defineProperty(window, "wemdDesktop", {
      value: undefined,
      configurable: true,
    });
    document.execCommand = vi.fn(() => true);
  });

  it("copies the styled HTML source to the clipboard as plain text", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);

    await copyAsHtml("# Hello", "#wemd { color: red; }");

    expect(mocked.renderContainer).toHaveBeenCalledWith(
      "# Hello",
      "#wemd { color: red; }",
      {},
    );
    expect(writeText).toHaveBeenCalledWith(styledHtml);
    expect(mocked.toastSuccess).toHaveBeenCalledWith("已复制带样式 HTML");
    expect(mocked.toastError).not.toHaveBeenCalled();
  });

  it("prefers the desktop clipboard bridge", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);
    Object.defineProperty(window, "wemdDesktop", {
      configurable: true,
      value: {
        clipboard: {
          writeText: mocked.desktopClipboardWriteText.mockResolvedValue({
            success: true,
          }),
        },
      },
    });

    await copyAsHtml("# Hello", "");

    expect(mocked.desktopClipboardWriteText).toHaveBeenCalledWith(styledHtml);
    expect(writeText).not.toHaveBeenCalled();
    expect(document.execCommand).not.toHaveBeenCalled();
  });

  it("falls back to navigator.clipboard when the desktop bridge fails", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);
    Object.defineProperty(window, "wemdDesktop", {
      configurable: true,
      value: {
        clipboard: {
          writeText: mocked.desktopClipboardWriteText.mockResolvedValue({
            success: false,
            error: "bridge failed",
          }),
        },
      },
    });

    await copyAsHtml("# Hello", "");

    expect(mocked.desktopClipboardWriteText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(styledHtml);
    expect(document.execCommand).not.toHaveBeenCalled();
    expect(mocked.toastSuccess).toHaveBeenCalledWith("已复制带样式 HTML");
  });

  it("falls back to execCommand when the Clipboard API fails", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    stubClipboard(writeText);
    const execSpy = vi.spyOn(document, "execCommand").mockReturnValue(true);

    await copyAsHtml("# Hello", "");

    expect(writeText).toHaveBeenCalledWith(styledHtml);
    expect(execSpy).toHaveBeenCalledWith("copy");
    expect(mocked.toastSuccess).toHaveBeenCalledWith("已复制带样式 HTML");
    expect(mocked.toastError).not.toHaveBeenCalled();
  });

  it("toasts an error without throwing when all copy paths fail", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    stubClipboard(writeText);
    vi.spyOn(document, "execCommand").mockReturnValue(false);

    await expect(copyAsHtml("# Hello", "")).resolves.toBeUndefined();

    expect(mocked.toastError).toHaveBeenCalledWith("复制 HTML 失败");
    expect(mocked.toastSuccess).not.toHaveBeenCalled();
  });

  it("toasts an error when rendering fails", async () => {
    mocked.renderContainer.mockRejectedValue(new Error("render failed"));

    await expect(copyAsHtml("# Hello", "")).resolves.toBeUndefined();

    expect(mocked.toastError).toHaveBeenCalledWith("复制 HTML 失败");
    expect(mocked.toastSuccess).not.toHaveBeenCalled();
  });
});
