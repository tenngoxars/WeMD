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
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
    });
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
      "",
    );

    const [html] = mocked.desktopClipboardWriteText.mock.calls[0] as [string];
    expect(html).toContain('class="chapter"');
    expect(html).toContain('id="summary"');
    expect(html).toContain('data-kind="heading"');
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("data-wemd-source-");
  });

  it("保留图片、链接和行内格式元素的局部属性", async () => {
    await copyAsHtml(
      "![封面](https://example.com/cover.png){.hero-image #cover}\n\n[查看详情](https://example.com){.cta-link}\n\n这是 **重点内容**{.inline-highlight}。",
      "",
    );

    const [html] = mocked.desktopClipboardWriteText.mock.calls[0] as [string];
    expect(html).toContain('class="hero-image"');
    expect(html).toContain('id="cover"');
    expect(html).toContain('src="https://example.com/cover.png"');
    expect(html).toContain('class="cta-link"');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('class="inline-highlight"');
  });
});
