import { describe, expect, it, vi } from "vitest";
import toast from "react-hot-toast";
import { renderWechatContainer } from "../../services/wechatCopyService";
import {
  buildHtmlDocument,
  downloadHtml,
  extractTitle,
  sanitizeExportHtml,
} from "../../services/htmlExportService";

vi.mock("../../services/wechatCopyService", () => ({
  renderWechatContainer: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

describe("buildHtmlDocument", () => {
  it("生成可直接打开的独立 HTML 并转义标题", () => {
    const html = buildHtmlDocument(
      '<section id="wemd"><p>正文</p></section>',
      "A & B <C>",
    );

    expect(html).toContain("<!doctype html>");
    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toContain("<title>A &amp; B &lt;C&gt;</title>");
    expect(html).toContain('<section id="wemd"><p>正文</p></section>');
    expect(html).toContain("#wemd img");
  });
});

describe("sanitizeExportHtml", () => {
  it("移除脚本、事件属性、iframe 和可执行 URL", () => {
    const safe = sanitizeExportHtml(
      [
        "<div>",
        "<script>alert(1)</script>",
        '<iframe src="https://example.com"></iframe>',
        '<a href="javascript:alert(1)" onclick="steal()">链接</a>',
        '<img src="data:image/png;base64,AA" onerror="leak()">',
        "</div>",
      ].join(""),
    );

    expect(safe).not.toContain("<script");
    expect(safe).not.toContain("<iframe");
    expect(safe).not.toContain("onclick");
    expect(safe).not.toContain("onerror");
    expect(safe).not.toContain("javascript:");
    expect(safe).toContain("data:image/png;base64,AA");
  });
});

describe("extractTitle", () => {
  it("用渲染后的标题，忽略代码块里的井号注释", () => {
    const root = document.createElement("div");
    root.innerHTML = "<pre><code># 不是标题</code></pre><h2>真实标题</h2>";

    expect(extractTitle(root)).toBe("真实标题");
  });
});

describe("downloadHtml", () => {
  it("下载的文件保留内联样式和根节点 id", async () => {
    const container = document.createElement("div");
    container.innerHTML =
      '<div><h1><span class="content">标题</span></h1><p style="color:red">正文</p></div>';
    vi.mocked(renderWechatContainer).mockResolvedValue({
      container,
      requiresExactHtmlTransport: false,
      mathFallback: { imageCount: 0, fallbackCount: 0 },
    });

    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    const createObjectURL = vi.fn((blob: Blob) => (blob ? "blob:test" : ""));
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      value: createObjectURL,
      configurable: true,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      value: revokeObjectURL,
      configurable: true,
    });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    try {
      await downloadHtml("# 标题\n\n正文", "");

      const blob = createObjectURL.mock.calls[0][0] as Blob;
      const html = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsText(blob);
      });
      expect(html).toContain('id="wemd"');
      expect(html).toContain('style="color:red"');
      expect(html).toContain("标题");
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith("已开始下载 HTML");
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:test");
    } finally {
      click.mockRestore();
      Object.defineProperty(URL, "createObjectURL", {
        value: originalCreate,
        configurable: true,
      });
      Object.defineProperty(URL, "revokeObjectURL", {
        value: originalRevoke,
        configurable: true,
      });
    }
  });
});
