import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  loadMathJax: vi.fn(),
  parserRender: vi.fn(),
  processHtml: vi.fn(),
  electronClipboardWrite: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
  default: {
    success: mocked.toastSuccess,
    error: mocked.toastError,
  },
}));

vi.mock("@wemd/core", () => ({
  createMarkdownParser: () => ({
    render: mocked.parserRender,
  }),
  processHtml: mocked.processHtml,
}));

vi.mock("../../utils/mathJaxLoader", () => ({
  loadMathJax: mocked.loadMathJax,
}));

vi.mock("../../utils/linkFootnote", () => ({
  convertLinksToFootnotes: (html: string) => html,
}));

vi.mock("../../store/publishingPreferences", () => ({
  getPublishingPreference: () => false,
}));

vi.mock("../../services/inlineStyleVarResolver", () => ({
  resolveInlineStyleVariablesForCopy: (html: string) => html,
  applyLightRootVars: vi.fn(),
}));

vi.mock("../../services/wechatCounterCompat", () => ({
  materializeCounterPseudoContent: (html: string) => html,
  stripCounterPseudoRules: (css: string) => css,
}));

vi.mock("../../services/wechatMermaidRenderer", () => ({
  renderMermaidBlocks: vi.fn(async () => undefined),
}));

vi.mock("../../services/wechatTableRenderer", () => ({
  renderTableBlocks: vi.fn(async () => undefined),
}));

import { copyToWechat } from "../../services/wechatCopyService";

const createMathJaxSvg = (latex: string) => {
  if (latex.includes("\\boldsymbol")) {
    const wrapper = document.createElement("div");
    wrapper.innerHTML =
      "<mjx-container><mjx-merror><mtext>\\boldsymbol</mtext></mjx-merror></mjx-container>";
    return wrapper;
  }

  const wrapper = document.createElement("div");
  wrapper.innerHTML =
    '<svg width="10ex" height="3ex" style="vertical-align: -0.3ex;" fill="black" viewBox="0 0 1000 300"><g fill="black" stroke="black"><path d="M0 0h10v10H0z"></path></g></svg>';
  return wrapper;
};

const installMathJax = (tex2svg = vi.fn(createMathJaxSvg)) => {
  mocked.loadMathJax.mockImplementation(async () => {
    Object.defineProperty(window, "MathJax", {
      configurable: true,
      value: {
        texReset: vi.fn(),
        tex2svg,
      },
    });
  });
  return tex2svg;
};

describe("wechat copy math compatibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.parserRender.mockReturnValue("<p>$\\boldsymbol{x}$</p>");
    mocked.processHtml.mockReturnValue(
      '<section id="wemd"><p><span class="inline-equation" data-latex="\\boldsymbol{x}"><span class="katex"><span class="katex-mathml"><math><semantics><mrow><mi>x</mi></mrow><annotation encoding="application/x-tex">\\boldsymbol{x}</annotation></semantics></math></span><span class="katex-html" aria-hidden="true"><span class="base" style="width:min-content;"><span class="mord boldsymbol">x</span></span></span></span></span></p></section>',
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
  });

  it("converts leftover KaTeX markup to SVG and strips hidden source", async () => {
    const tex2svg = installMathJax();

    await copyToWechat("$\\boldsymbol{x}$", "#wemd p { margin: 18px 0; }");

    const [payload] = mocked.electronClipboardWrite.mock.calls[0] as [
      { html: string; text: string },
    ];
    expect(tex2svg).toHaveBeenNthCalledWith(1, "\\boldsymbol{x}", {
      display: false,
    });
    expect(tex2svg).toHaveBeenNthCalledWith(2, "\\mathbf{x}", {
      display: false,
    });
    expect(payload.html).toContain("<svg");
    expect(payload.html).not.toContain("katex-html");
    expect(payload.html).not.toContain("katex-mathml");
    expect(payload.html).not.toContain("application/x-tex");
    expect(payload.html).not.toContain("\\boldsymbol");
    expect(mocked.toastSuccess).toHaveBeenCalledWith(
      "已复制，部分复杂公式已自动保真处理",
      expect.any(Object),
    );
  });

  it("converts high-risk block formulas to inline SVG before clipboard write", async () => {
    mocked.processHtml.mockReturnValue(
      '<section id="wemd"><section class="block-equation" data-latex="\\boldsymbol{\\frac{x}{y}}"><span class="katex"><span class="katex-html"><span class="base"><span class="mord">x</span></span></span></span></section></section>',
    );
    const tex2svg = installMathJax();

    await copyToWechat(
      "$$\\boldsymbol{\\frac{x}{y}}$$",
      "#wemd p { margin: 18px 0; }",
    );

    const [payload] = mocked.electronClipboardWrite.mock.calls[0] as [
      { html: string; text: string },
    ];
    expect(mocked.loadMathJax).toHaveBeenCalledTimes(1);
    expect(tex2svg).toHaveBeenNthCalledWith(1, "\\boldsymbol{\\frac{x}{y}}", {
      display: true,
    });
    expect(tex2svg).toHaveBeenNthCalledWith(2, "\\mathbf{\\frac{x}{y}}", {
      display: true,
    });
    expect(payload.html).toContain("<svg");
    expect(payload.html).toContain("currentColor");
    expect(payload.html).toContain("display: block");
    expect(payload.html).toContain("max-width: 100%");
    expect(payload.html).not.toContain("<img");
    expect(payload.html).not.toContain("katex-html");
    expect(payload.html).not.toContain('fill="black"');
    expect(mocked.toastSuccess).toHaveBeenCalledWith(
      "已复制，部分复杂公式已自动保真处理",
      expect.any(Object),
    );
  });

  it("keeps high-risk inline formulas as inline SVG in the paragraph", async () => {
    mocked.processHtml.mockReturnValue(
      '<section id="wemd"><p>正文<span class="inline-equation" data-latex="\\frac{\\Delta W}{\\Delta t}"><span class="katex"><span class="katex-html"><span class="base"><span class="mord">x</span></span></span></span></span>结束</p></section>',
    );
    const tex2svg = installMathJax();

    await copyToWechat(
      "正文 $\\frac{\\Delta W}{\\Delta t}$ 结束",
      "#wemd p { margin: 18px 0; }",
    );

    const [payload] = mocked.electronClipboardWrite.mock.calls[0] as [
      { html: string; text: string },
    ];
    expect(tex2svg).toHaveBeenCalledWith("\\frac{\\Delta W}{\\Delta t}", {
      display: false,
    });
    expect(payload.html).toContain("inline-equation");
    expect(payload.html).toContain("<svg");
    expect(payload.html).toContain("vertical-align: -0.3ex");
    expect(payload.html).toContain("currentColor");
    expect(payload.html).not.toContain("display: block");
    expect(payload.html).not.toContain("katex-html");
    expect(payload.html).toContain("正文");
    expect(payload.html).toContain("结束");
  });

  it("renders each high-risk formula as its own SVG", async () => {
    mocked.processHtml.mockReturnValue(
      '<section id="wemd"><section class="block-equation" data-latex="\\frac{x}{y}"><span class="katex"><span class="katex-html"><span class="base"><span class="mord">x</span></span></span></span></section><section class="block-equation" data-latex="\\sqrt{a+b}"><span class="katex"><span class="katex-html"><span class="base"><span class="mord">a</span></span></span></span></section></section>',
    );
    installMathJax();

    await copyToWechat(
      "$$\\frac{x}{y}$$\n\n$$\\sqrt{a+b}$$",
      "#wemd p { margin: 18px 0; }",
    );

    const [payload] = mocked.electronClipboardWrite.mock.calls[0] as [
      { html: string; text: string },
    ];
    expect(payload.html.match(/<svg/g)?.length).toBe(2);
    expect(payload.html).not.toContain("katex-html");
  });

  it("converts leftover KaTeX height:0 inline formulas to SVG", async () => {
    mocked.processHtml.mockReturnValue(
      '<section id="wemd"><p>当<span class="inline-equation" data-latex="W\'(t)"><span class="katex"><span class="katex-html"><span class="vlist"><span style="height:0;position:relative;">\'</span></span></span></span></span>不存在</p></section>',
    );
    const tex2svg = installMathJax();

    await copyToWechat("$W'(t)$", "#wemd p { margin: 18px 0; }");

    const [payload] = mocked.electronClipboardWrite.mock.calls[0] as [
      { html: string; text: string },
    ];
    expect(tex2svg).toHaveBeenCalledWith("W'(t)", { display: false });
    expect(payload.html).toContain("<svg");
    expect(payload.html).not.toContain("height:0");
    expect(payload.html).not.toContain("katex-html");
  });

  it("fails copy when MathJax loading hangs", async () => {
    vi.useFakeTimers();
    mocked.processHtml.mockReturnValue(
      '<section id="wemd"><span class="inline-equation" data-latex="\\frac{x}{y}"><span class="katex"><span class="katex-html">x</span></span></span></section>',
    );
    mocked.loadMathJax.mockReturnValue(new Promise(() => undefined));

    try {
      const copyPromise = copyToWechat(
        "$\\frac{x}{y}$",
        "#wemd p { margin: 18px 0; }",
      );
      const expectation =
        expect(copyPromise).rejects.toThrow("MathJax 加载超时");
      await vi.advanceTimersByTimeAsync(4000);
      await expectation;
    } finally {
      vi.useRealTimers();
    }

    expect(mocked.electronClipboardWrite).not.toHaveBeenCalled();
    expect(mocked.toastError).toHaveBeenCalled();
    expect(mocked.toastSuccess).not.toHaveBeenCalled();
  });
});
