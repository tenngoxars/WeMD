import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  electronClipboardWrite: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("../../services/wechatMathCompat", () => ({
  renderHighRiskMathAsImages: vi.fn(async () => false),
  stripHiddenMathMarkupForWechat: vi.fn(),
}));

vi.mock("../../services/wechatMermaidRenderer", () => ({
  renderMermaidBlocks: vi.fn(async () => undefined),
}));

import { copyToWechat } from "../../services/wechatCopyService";

describe("公众号复制属性语法", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    });
    mocked.electronClipboardWrite.mockResolvedValue({ success: true });
    Object.defineProperty(window, "electron", {
      configurable: true,
      value: {
        isElectron: true,
        platform: "darwin",
        clipboard: { writeHTML: mocked.electronClipboardWrite },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("按合法属性匹配自定义 CSS 并写入最终剪贴板 HTML", async () => {
    await copyToWechat(
      "摘要内容。 {.summary data-kind=abstract}",
      '#wemd .summary[data-kind="abstract"] { color: rgb(180, 0, 0); }',
    );

    const [payload] = mocked.electronClipboardWrite.mock.calls[0] as [
      { html: string; text: string },
    ];
    expect(payload.html).toContain('class="summary"');
    expect(payload.html).toContain('data-kind="abstract"');
    expect(payload.html).toContain("color: rgb(180, 0, 0)");
    expect(payload.html).not.toContain("data-tool");
    expect(payload.html).not.toContain("data-wemd-source-");
  });

  it("为图片、链接和行内格式内联局部样式", async () => {
    await copyToWechat(
      "![封面](https://example.com/cover.png){.hero-image #cover}\n\n[查看详情](https://example.com){.cta-link}\n\n这是 **重点内容**{.inline-highlight}。",
      `
        #wemd .hero-image { border-radius: 12px; }
        #wemd .cta-link { color: rgb(0, 90, 180); }
        #wemd .inline-highlight { background-color: rgb(255, 230, 120); }
      `,
    );

    const [payload] = mocked.electronClipboardWrite.mock.calls[0] as [
      { html: string; text: string },
    ];
    expect(payload.html).toContain('class="hero-image"');
    expect(payload.html).toContain('id="cover"');
    expect(payload.html).toContain("border-radius: 12px");
    expect(payload.html).toContain('class="cta-link"');
    expect(payload.html).toContain("color: rgb(0, 90, 180)");
    expect(payload.html).toContain('class="inline-highlight"');
    expect(payload.html).toContain("background-color: rgb(255, 230, 120)");
    expect(payload.html).not.toContain("data-tool");
  });
  it("在最终剪贴板 HTML 中修正公众号不兼容属性", async () => {
    await copyToWechat(
      `正文内容。 {.spec-align}

<svg viewBox="0 0 10 10">
  <circle cx="5" cy="5" r="4">
    <animate attributeName="opacity" begin="touchstart" dur="1s"></animate>
  </circle>
</svg>`,
      `
        #wemd .spec-align {
          text-align: start;
          caret-color: rgba(0, 0, 0, 0);
        }
      `,
    );

    const [payload] = mocked.electronClipboardWrite.mock.calls[0] as [
      { html: string; text: string },
    ];
    expect(payload.html).toContain("text-align: left");
    expect(payload.html).not.toMatch(/text-align:\s*(start|end)/i);
    expect(payload.html).not.toContain("caret-color");
    expect(payload.html).toContain('begin="touchstart; click"');
  });
});
