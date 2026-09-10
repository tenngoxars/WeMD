import { loadMathJax } from "../utils/mathJaxLoader";
import {
  BOLDSYMBOL_COMMAND,
  getMathJaxLatexCandidates,
  normalizeBoldSymbolText,
} from "./math/formulaLatexPolicy";

const MATHJAX_LOAD_TIMEOUT_MS = 4000;

interface MathImageRenderResult {
  imageCount: number;
}

const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> => {
  const { promise: timeoutPromise, reject } = Promise.withResolvers<never>();
  const timeoutId = window.setTimeout(
    () => reject(new Error(message)),
    timeoutMs,
  );
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
};

const applyCurrentColor = (svg: SVGElement): void => {
  const retarget = (el: Element) => {
    for (const attr of ["fill", "stroke"] as const) {
      const value = el.getAttribute(attr);
      if (!value) continue;
      const normalized = value.trim().toLowerCase();
      if (normalized === "none" || normalized === "transparent") continue;
      el.setAttribute(attr, "currentColor");
    }
  };

  retarget(svg);
  svg.querySelectorAll("[fill], [stroke]").forEach(retarget);
};

const renderLatexToSvg = (latex: string, display: boolean): SVGElement => {
  const mathJax = window.MathJax;
  if (!mathJax?.tex2svg) {
    throw new Error("复杂公式渲染失败");
  }
  if (typeof mathJax.texReset === "function") mathJax.texReset();

  let lastError: unknown;
  for (const candidate of getMathJaxLatexCandidates(latex)) {
    try {
      const container = mathJax.tex2svg(candidate, { display }) as HTMLElement;
      if (
        container.textContent?.includes(BOLDSYMBOL_COMMAND) ||
        container.querySelector("mjx-merror, merror, [data-mjx-error]")
      ) {
        throw new Error("MathJax 输出包含未解析的 boldsymbol");
      }
      const svg = container.querySelector("svg");
      if (!svg) throw new Error("MathJax 未输出 SVG");
      const clone = svg.cloneNode(true) as SVGElement;
      applyCurrentColor(clone);
      if (display) {
        clone.style.display = "block";
        clone.style.margin = "1em auto";
        clone.style.maxWidth = "100%";
      }
      return clone;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("复杂公式渲染失败");
};

export const renderHighRiskMathAsImages = async (
  container: HTMLElement,
): Promise<MathImageRenderResult> => {
  const formulaNodes = Array.from(
    container.querySelectorAll<HTMLElement>(
      ".inline-equation[data-latex], .block-equation[data-latex]",
    ),
  );

  if (formulaNodes.length === 0) return { imageCount: 0 };

  await withTimeout(loadMathJax(), MATHJAX_LOAD_TIMEOUT_MS, "MathJax 加载超时");
  if (!window.MathJax?.tex2svg) {
    throw new Error("复杂公式渲染失败");
  }

  for (const node of formulaNodes) {
    const latex = node.getAttribute("data-latex") || "";
    const display = node.classList.contains("block-equation");
    node.replaceChildren(renderLatexToSvg(latex, display));
    node.removeAttribute("data-latex");
  }

  return { imageCount: formulaNodes.length };
};

/**
 * 微信复制公式兼容处理。
 * KaTeX 会输出隐藏 MathML 与 TeX annotation，微信清洗后可能暴露源码。
 */
export const stripHiddenMathMarkupForWechat = (
  container: HTMLElement,
): void => {
  container.querySelectorAll(".katex-mathml").forEach((node) => {
    node.remove();
  });

  container
    .querySelectorAll('annotation[encoding="application/x-tex"]')
    .forEach((node) => {
      node.remove();
    });

  container.querySelectorAll<HTMLElement>("[data-latex]").forEach((node) => {
    node.removeAttribute("data-latex");
  });

  normalizeBoldSymbolText(container);

  container
    .querySelectorAll<HTMLElement>(".katex, .katex-html, .base")
    .forEach((node) => {
      node.style.setProperty("white-space", "nowrap", "important");
    });

  container.querySelectorAll<HTMLElement>(".katex-html").forEach((node) => {
    node.style.setProperty("display", "inline-block", "important");
  });

  container.querySelectorAll<HTMLElement>(".base").forEach((node) => {
    node.style.setProperty("display", "inline-block", "important");
    node.style.setProperty("width", "auto", "important");
    node.style.setProperty("min-width", "0", "important");
  });
};
