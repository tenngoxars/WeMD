import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  parserRender: vi.fn(),
  processHtml: vi.fn(),
  electronClipboardWrite: vi.fn(),
  tableWrapEnabled: false,
}));

vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@wemd/core", () => ({
  createMarkdownParser: () => ({ render: mocked.parserRender }),
  processHtml: mocked.processHtml,
}));

vi.mock("../../utils/linkFootnote", () => ({
  convertLinksToFootnotes: (html: string) => html,
}));

vi.mock("../../store/publishingPreferences", () => ({
  getPublishingPreference: (preference: string) =>
    preference === "tableWrap" && mocked.tableWrapEnabled,
}));

vi.mock("../../services/inlineStyleVarResolver", () => ({
  resolveInlineStyleVariablesForCopy: (html: string) => html,
  applyLightRootVars: vi.fn(),
}));

vi.mock("../../services/wechatCounterCompat", () => ({
  materializeCounterPseudoContent: (html: string) => html,
  stripCounterPseudoRules: (css: string) => css,
}));

vi.mock("../../services/wechatMathCompat", () => ({
  renderHighRiskMathAsImages: vi.fn(async () => false),
  stripHiddenMathMarkupForWechat: vi.fn(),
}));

vi.mock("../../services/wechatMermaidRenderer", () => ({
  renderMermaidBlocks: vi.fn(async () => undefined),
}));

import { copyToWechat } from "../../services/wechatCopyService";

describe("微信复制表格布局", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.tableWrapEnabled = true;
    mocked.parserRender.mockReturnValue("| 表头 |\n| --- |\n| 内容 |");
    mocked.processHtml.mockReturnValue(
      '<section id="wemd"><div class="table-container" style="overflow-x:auto"><table style="min-width:100%;white-space:nowrap"><tbody><tr><td style="min-width:100px;white-space:nowrap">很长的内容</td></tr></tbody></table></div></section>',
    );
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

  it("将当前自动换行偏好应用到最终复制 HTML", async () => {
    await copyToWechat("| 表头 |", "#wemd td { min-width: 100px; }");

    const [payload] = mocked.electronClipboardWrite.mock.calls[0] as [
      { html: string; text: string },
    ];
    expect(payload.html).toContain("overflow-x: visible");
    expect(payload.html).toContain("min-width: 0");
    expect(payload.html).toContain("white-space: normal");
    expect(payload.html).toContain("overflow-wrap: anywhere");
    expect(payload.html).not.toContain("data-ignore-width");
  });

  it("为横向滚动表格添加官方宽度检测豁免", async () => {
    mocked.tableWrapEnabled = false;

    await copyToWechat("| 表头 |", "#wemd td { min-width: 100px; }");

    const [payload] = mocked.electronClipboardWrite.mock.calls[0] as [
      { html: string; text: string },
    ];
    expect(payload.html).toContain('data-ignore-width=""');
    expect(payload.html).toContain("overflow-x: auto");
  });
});
