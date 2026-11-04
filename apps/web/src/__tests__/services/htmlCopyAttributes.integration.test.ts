import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  desktopClipboardWriteText: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

import { copyAsHtml } from "../../services/htmlCopyService";

describe("复制 HTML 属性语法", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.desktopClipboardWriteText.mockResolvedValue({ success: true });
    Object.defineProperty(window, "wemdDesktop", {
      configurable: true,
      value: {
        clipboard: { writeText: mocked.desktopClipboardWriteText },
      },
    });
  });

  it("保留合法属性并排除危险属性", async () => {
    await copyAsHtml(
      '## 摘要 {.chapter #summary data-kind=heading onclick="alert(1)"}',
    );

    expect(mocked.desktopClipboardWriteText).toHaveBeenCalledWith(
      '<h2 class="chapter" id="summary" data-kind="heading">摘要</h2>\n',
    );
    const [html] = mocked.desktopClipboardWriteText.mock.calls[0] as [string];
    expect(html).not.toContain("data-wemd-source-");
  });

  it("保留图片、链接和行内格式元素的局部属性", async () => {
    await copyAsHtml(
      "![封面](https://example.com/cover.png){.hero-image #cover}\n\n[查看详情](https://example.com){.cta-link}\n\n这是 **重点内容**{.inline-highlight}。",
    );

    const [html] = mocked.desktopClipboardWriteText.mock.calls[0] as [string];
    expect(html).toContain(
      '<img src="https://example.com/cover.png" alt="封面" class="hero-image" id="cover">',
    );
    expect(html).toContain(
      '<a href="https://example.com" class="cta-link">查看详情</a>',
    );
    expect(html).toContain(
      '<strong class="inline-highlight">重点内容</strong>',
    );
  });
});
