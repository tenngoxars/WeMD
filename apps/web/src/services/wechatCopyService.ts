import toast from "react-hot-toast";
import mermaid from "mermaid";
import { processHtml, createMarkdownParser } from "@wemd/core";
import katexCss from "katex/dist/katex.min.css?raw";
import { loadMathJax } from "../utils/mathJaxLoader";
import { hasMathFormula } from "../utils/katexRenderer";
import { convertLinksToFootnotes } from "../utils/linkFootnote";
import { getLinkToFootnoteEnabled } from "../components/Editor/ToolbarState";
import { useThemeStore } from "../store/themeStore";
import { resolveInlineStyleVariablesForCopy } from "./inlineStyleVarResolver";
import {
  materializeCounterPseudoContent,
  stripCounterPseudoRules,
} from "./wechatCounterCompat";
import { expandCSSVariables } from "./cssVariableExpander";
import {
  getMermaidConfig,
  getThemedMermaidDiagram,
} from "../utils/mermaidConfig";

const buildCopyCss = (themeCss: string) => {
  if (!themeCss) return katexCss;
  // 复制前展开 CSS 变量为具体值，消除微信清洗 var() 导致的样式丢失
  const expandedCss = expandCSSVariables(themeCss);
  return `${expandedCss}\n${katexCss}`;
};

/**
 * 将 HTML 中的 checkbox 转换为 emoji
 * 微信公众号会过滤 <input> 标签，需要转为 emoji 替代
 */
const convertCheckboxesToEmoji = (html: string): string => {
  // 使用 &nbsp; 确保空格不被微信吞掉
  // 先替换选中的 checkbox（包含 checked 属性）
  let result = html.replace(/<input[^>]*checked[^>]*>/gi, "✅&nbsp;");
  // 再替换未选中的 checkbox
  result = result.replace(
    /<input[^>]*type=["']checkbox["'][^>]*>/gi,
    "⬜&nbsp;",
  );
  return result;
};

export const stripCopyMetadata = (container: HTMLElement): void => {
  const root = container.firstElementChild;
  if (root instanceof HTMLElement && root.id === "wemd") {
    root.removeAttribute("id");
  }

  container.querySelectorAll<HTMLElement>("[data-tool]").forEach((node) => {
    node.removeAttribute("data-tool");
  });

  container
    .querySelectorAll<HTMLElement>("[data-wemd-counter-generated]")
    .forEach((node) => {
      node.removeAttribute("data-wemd-counter-generated");
    });
};

const parseAlpha = (token: string): number | null => {
  const trimmed = token.trim();
  if (!trimmed) return null;

  if (trimmed.endsWith("%")) {
    const percent = Number.parseFloat(trimmed.slice(0, -1));
    return Number.isFinite(percent) ? percent / 100 : null;
  }

  const value = Number.parseFloat(trimmed);
  return Number.isFinite(value) ? value : null;
};

const getFunctionalColorAlpha = (normalized: string): number | null => {
  const match = normalized.match(/^(rgba?|hsla?)\((.*)\)$/);
  if (!match) return null;

  const fnName = match[1];
  const body = match[2].trim();

  if (body.includes("/")) {
    const slashIndex = body.lastIndexOf("/");
    const alphaToken = body.slice(slashIndex + 1);
    return parseAlpha(alphaToken);
  }

  if (fnName === "rgba" || fnName === "hsla") {
    const commaParts = body.split(",");
    if (commaParts.length === 4) {
      return parseAlpha(commaParts[3]);
    }
  }

  return null;
};

const transformWemdRootSectionToDiv = (container: HTMLElement): void => {
  const root = container.firstElementChild;
  if (
    !(root instanceof HTMLElement) ||
    root.tagName !== "SECTION" ||
    root.id !== "wemd" ||
    container.childElementCount !== 1
  ) {
    return;
  }

  const wrapper = document.createElement("div");
  Array.from(root.attributes).forEach((attr) => {
    wrapper.setAttribute(attr.name, attr.value);
  });
  while (root.firstChild) {
    wrapper.appendChild(root.firstChild);
  }
  container.replaceChildren(wrapper);
};

const isTransparentBackground = (value: string): boolean => {
  const normalized = value.replace(/\s+/g, "").toLowerCase();
  if (normalized === "transparent" || normalized.startsWith("transparent")) {
    return true;
  }

  // #RGBA / #RRGGBBAA
  if (/^#[0-9a-f]{4}$/.test(normalized)) {
    return normalized[4] === "0";
  }
  if (/^#[0-9a-f]{8}$/.test(normalized)) {
    return normalized.slice(6, 8) === "00";
  }

  const alpha = getFunctionalColorAlpha(normalized);
  return alpha !== null && alpha <= 0;
};

const hasExplicitBackgroundImage = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;

  if (/^none(\s*,\s*none)*$/.test(normalized)) return false;
  if (
    normalized === "initial" ||
    normalized === "inherit" ||
    normalized === "unset" ||
    normalized === "revert" ||
    normalized === "revert-layer"
  ) {
    return false;
  }

  return true;
};

const isZeroSpacing = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return true;
  if (normalized === "0" || normalized === "0px" || normalized === "0%") {
    return true;
  }
  return normalized.split(/\s+/).every((token) => {
    return token === "0" || token === "0px" || token === "0%";
  });
};

const mergeHorizontalPadding = (
  existingPadding: string,
  rootPadding: string,
): string => {
  const normalized = existingPadding.trim().toLowerCase();
  if (
    normalized === "auto" ||
    normalized === "inherit" ||
    normalized === "initial" ||
    normalized === "unset" ||
    normalized === "revert" ||
    normalized === "revert-layer"
  ) {
    // 这些关键字无法与长度通过 calc 相加，回退为根节点留白值。
    return rootPadding;
  }
  if (isZeroSpacing(existingPadding)) {
    return rootPadding;
  }
  return `calc(${existingPadding} + ${rootPadding})`;
};

const isHeadingElement = (node: HTMLElement): boolean => {
  const tagName = node.tagName;
  return (
    tagName === "H1" ||
    tagName === "H2" ||
    tagName === "H3" ||
    tagName === "H4" ||
    tagName === "H5" ||
    tagName === "H6"
  );
};

/**
 * 判断元素是否应使用 margin 而非 padding 迁移水平留白。
 * 含 border / background 的块级元素（标题、引用、代码块、提示块）需用 margin，
 * 否则 padding 只会把内容往里推，边框和背景仍贴在容器边缘。
 */
const shouldUseMarginForHorizontalOffset = (node: HTMLElement): boolean => {
  if (isHeadingElement(node)) return true;
  const tagName = node.tagName;
  if (tagName === "BLOCKQUOTE") return true;
  if (tagName === "PRE") return true;
  if (node.classList.contains("callout")) return true;
  return false;
};

/**
 * 微信编辑器会清理粘贴内容最外层元素的 padding。
 * 复制前将根节点 padding 迁移到内层包裹元素，确保页面左右留白生效。
 */
const relocateRootPaddingToInnerWrapper = (container: HTMLElement): void => {
  const root = container.firstElementChild;
  if (!(root instanceof HTMLElement)) return;

  const paddingLeft = root.style.getPropertyValue("padding-left").trim();
  const paddingRight = root.style.getPropertyValue("padding-right").trim();
  const paddingTop = root.style.getPropertyValue("padding-top").trim();
  const paddingBottom = root.style.getPropertyValue("padding-bottom").trim();

  const hasHorizontalPadding =
    !isZeroSpacing(paddingLeft) || !isZeroSpacing(paddingRight);
  const hasVerticalPadding =
    !isZeroSpacing(paddingTop) || !isZeroSpacing(paddingBottom);

  if (!hasHorizontalPadding && !hasVerticalPadding) {
    return;
  }

  const elementChildren = Array.from(root.children).filter(
    (node): node is HTMLElement => node instanceof HTMLElement,
  );

  // 左右留白优先下沉到一级内容块，避免微信清洗外层容器 padding。
  if (hasHorizontalPadding && elementChildren.length > 0) {
    elementChildren.forEach((child) => {
      const useMarginForHorizontalOffset =
        shouldUseMarginForHorizontalOffset(child);
      if (!isZeroSpacing(paddingLeft)) {
        if (useMarginForHorizontalOffset) {
          const existingMarginLeft = child.style
            .getPropertyValue("margin-left")
            .trim();
          child.style.setProperty(
            "margin-left",
            mergeHorizontalPadding(existingMarginLeft, paddingLeft),
          );
        } else {
          const existingPaddingLeft = child.style
            .getPropertyValue("padding-left")
            .trim();
          child.style.setProperty(
            "padding-left",
            mergeHorizontalPadding(existingPaddingLeft, paddingLeft),
          );
        }
      }
      if (!isZeroSpacing(paddingRight)) {
        if (useMarginForHorizontalOffset) {
          const existingMarginRight = child.style
            .getPropertyValue("margin-right")
            .trim();
          child.style.setProperty(
            "margin-right",
            mergeHorizontalPadding(existingMarginRight, paddingRight),
          );
        } else {
          const existingPaddingRight = child.style
            .getPropertyValue("padding-right")
            .trim();
          child.style.setProperty(
            "padding-right",
            mergeHorizontalPadding(existingPaddingRight, paddingRight),
          );
        }
      }
    });
  }

  // 仅当存在垂直 padding 时，才额外包一层承接上下留白。
  if (hasVerticalPadding) {
    const innerWrapper = document.createElement("div");
    innerWrapper.style.display = "block";
    innerWrapper.style.width = "100%";
    innerWrapper.style.boxSizing = "border-box";

    if (!isZeroSpacing(paddingTop)) {
      innerWrapper.style.setProperty("padding-top", paddingTop);
    }
    if (!isZeroSpacing(paddingBottom)) {
      innerWrapper.style.setProperty("padding-bottom", paddingBottom);
    }

    while (root.firstChild) {
      innerWrapper.appendChild(root.firstChild);
    }
    root.appendChild(innerWrapper);
  }

  root.style.removeProperty("padding");
  root.style.removeProperty("padding-left");
  root.style.removeProperty("padding-right");
  root.style.removeProperty("padding-top");
  root.style.removeProperty("padding-bottom");
};

/**
 * 提取根元素的背景色并从根元素上移除。
 * 微信会清洗最外层容器样式，因此背景色需要下沉到子块。
 * 返回有效（非透明）的背景色字符串，无则返回 null。
 */
const extractRootBackgroundColor = (container: HTMLElement): string | null => {
  const root = container.firstElementChild;
  if (!(root instanceof HTMLElement)) return null;

  const background = root.style.getPropertyValue("background");
  const backgroundColor = root.style.getPropertyValue("background-color");

  // 找出有效的非透明背景色
  let effectiveBg: string | null = null;
  if (backgroundColor && !isTransparentBackground(backgroundColor)) {
    effectiveBg = backgroundColor;
  } else if (background && !isTransparentBackground(background)) {
    effectiveBg = background;
  }

  // 清理根元素上的背景属性
  if (background) root.style.removeProperty("background");
  if (backgroundColor) root.style.removeProperty("background-color");

  if (root.style.length === 0 && root.hasAttribute("style")) {
    root.removeAttribute("style");
  }

  return effectiveBg;
};

const normalizeBlockBackgroundForWechat = (
  container: HTMLElement,
  rootBgColor: string | null,
): void => {
  const blocks = container.querySelectorAll<HTMLElement>(
    "p,h1,h2,h3,h4,h5,h6,ul,ol,li,section,figure,figcaption",
  );

  blocks.forEach((node) => {
    const background = node.style.getPropertyValue("background");
    const backgroundColor = node.style.getPropertyValue("background-color");
    const backgroundImage = node.style.getPropertyValue("background-image");
    const hasExplicitBackground =
      (background && !isTransparentBackground(background)) ||
      (backgroundColor && !isTransparentBackground(backgroundColor)) ||
      hasExplicitBackgroundImage(backgroundImage);

    if (hasExplicitBackground) return;

    if (rootBgColor) {
      node.style.setProperty("background-color", rootBgColor, "important");
    } else {
      node.style.setProperty("background", "transparent", "important");
      node.style.setProperty("background-color", "transparent", "important");
    }
    node.style.setProperty("background-image", "none", "important");
  });
};

export const normalizeCopyContainer = (container: HTMLElement): void => {
  transformWemdRootSectionToDiv(container);
  stripCopyMetadata(container);
  const rootBgColor = extractRootBackgroundColor(container);
  relocateRootPaddingToInnerWrapper(container);
  normalizeBlockBackgroundForWechat(container, rootBgColor);
};

const copyViaNativeExecCommand = (container: HTMLElement): boolean => {
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(container);
  selection?.removeAllRanges();
  selection?.addRange(range);
  try {
    return document.execCommand("copy");
  } finally {
    selection?.removeAllRanges();
  }
};

const getRenderedPlainText = (container: HTMLElement): string => {
  const innerText = container.innerText;
  if (typeof innerText === "string" && innerText.trim().length > 0) {
    return innerText;
  }
  return container.textContent || "";
};

const copyViaElectronClipboard = async (
  container: HTMLElement,
): Promise<{ success: boolean; error?: string } | null> => {
  const writeHTML = window.electron?.clipboard?.writeHTML;
  if (!writeHTML) return null;

  return writeHTML({
    html: container.innerHTML,
    text: getRenderedPlainText(container),
  });
};

const shouldPreferElectronClipboard = (): boolean => {
  const electron = window.electron;
  if (!electron?.isElectron) return false;

  // Windows 下优先使用与手动复制一致的选区链路，降低公众号样式丢失概率
  if (electron.platform === "win32") return false;
  if (electron.platform === "darwin" || electron.platform === "linux")
    return true;
  return false;
};

let mermaidInitialized = false;

const ensureMermaidInitialized = () => {
  if (mermaidInitialized) return;
  try {
    mermaid.initialize({ startOnLoad: false });
    mermaidInitialized = true;
  } catch (e) {
    console.error("Mermaid initialization failed in copy service:", e);
  }
};

const getThemeInfo = () => {
  const state = useThemeStore.getState();
  const themeId = state.themeId;
  const currentTheme =
    state.customThemes.find((t) => t.id === themeId) ||
    state.getAllThemes().find((t) => t.id === themeId);
  return currentTheme?.designerVariables;
};

const getSvgDimensions = (svgElement: SVGElement) => {
  const parseSize = (value: string | null): number | null => {
    if (!value) return null;
    const trimmed = value.trim();
    if (trimmed.endsWith("%")) return null;
    const parsed = Number.parseFloat(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const width = parseSize(svgElement.getAttribute("width"));
  const height = parseSize(svgElement.getAttribute("height"));

  if (width && height) {
    return { width, height };
  }

  const viewBox = svgElement.getAttribute("viewBox");
  if (viewBox) {
    const parts = viewBox
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (parts.length === 4 && parts.every(Number.isFinite)) {
      return { width: parts[2], height: parts[3] };
    }
  }

  return { width: 400, height: 300 };
};

/**
 * 将 SVG 转换为 PNG Data URL
 * 使用 Canvas 渲染，确保微信完全兼容
 * @param svgMarkup - 原始 SVG 字符串
 * @returns PNG 图片的 Data URL
 */
const svgMarkupToPng = async (svgMarkup: string): Promise<string> => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgMarkup, "image/svg+xml");
  const svgElement = doc.documentElement as unknown as SVGElement;
  const { width, height } = getSvgDimensions(svgElement);

  svgElement.setAttribute("width", String(width));
  svgElement.setAttribute("height", String(height));
  if (!svgElement.getAttribute("xmlns")) {
    svgElement.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  }

  // 序列化 SVG
  const svgData = new XMLSerializer().serializeToString(svgElement);
  const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgData)}`;

  // 加载图片
  const img = new Image();
  img.src = svgDataUrl;

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = (e) => reject(e);
  });

  // 使用 3x 分辨率渲染到 Canvas（高清）
  const scale = 3;
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);

  // 1. 填充白色背景（防止深色模式下透明背景看不清文字）
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  // 2. 绘制 SVG 图片
  ctx.drawImage(img, 0, 0);

  // 导出为 PNG
  return canvas.toDataURL("image/png");
};

const renderMermaidBlocks = async (container: HTMLElement): Promise<void> => {
  const mermaidBlocks = Array.from(container.querySelectorAll("pre.mermaid"));
  if (mermaidBlocks.length === 0) return;

  ensureMermaidInitialized();
  const designerVariables = getThemeInfo();
  const renderIdBase = `wemd-mermaid-${Date.now()}`;

  // 构建 Mermaid 配置
  const initConfig = getMermaidConfig(designerVariables);

  for (const [index, block] of mermaidBlocks.entries()) {
    const diagram = block.textContent ?? "";
    if (!diagram.trim()) continue;

    try {
      const themedDiagram = getThemedMermaidDiagram(diagram, initConfig);
      const { svg } = await mermaid.render(
        `${renderIdBase}-${index}`,
        themedDiagram,
      );
      const pngDataUrl = await svgMarkupToPng(svg);
      const figure = document.createElement("div");
      figure.style.margin = "1em 0";
      figure.style.textAlign = "center";

      const img = document.createElement("img");
      img.src = pngDataUrl;
      img.style.width = "100%";
      img.style.display = "block";
      img.style.margin = "0 auto";
      img.style.maxWidth = "100%";
      img.style.height = "auto";

      figure.appendChild(img);
      block.parentNode?.replaceChild(figure, block);
    } catch (error) {
      console.error("[WeMD] Mermaid render failed:", error);
    }
  }
};

export async function copyToWechat(
  markdown: string,
  css: string,
): Promise<void> {
  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.top = "-9999px";
  container.style.left = "-9999px";
  document.body.appendChild(container);

  try {
    const shouldLoadMath = hasMathFormula(markdown);
    if (shouldLoadMath) {
      await loadMathJax();
    }
    const parser = createMarkdownParser();
    const rawHtml = parser.render(markdown);
    const themedCss = buildCopyCss(css);
    const sanitizedCss = stripCounterPseudoRules(themedCss);
    const sourceHtml = getLinkToFootnoteEnabled()
      ? convertLinksToFootnotes(rawHtml)
      : rawHtml;
    const materializedHtml = materializeCounterPseudoContent(
      sourceHtml,
      themedCss,
    );
    const styledHtml = processHtml(materializedHtml, sanitizedCss, true, true);
    const resolvedHtml = resolveInlineStyleVariablesForCopy(styledHtml);
    // 转换 checkbox 为 emoji，微信不支持 input 标签
    const finalHtml = convertCheckboxesToEmoji(resolvedHtml);

    container.innerHTML = finalHtml;
    normalizeCopyContainer(container);

    await renderMermaidBlocks(container);

    let copied = false;

    const preferElectronClipboard = shouldPreferElectronClipboard();

    if (!preferElectronClipboard) {
      copied = copyViaNativeExecCommand(container);
    }

    if (!copied && window.electron?.isElectron) {
      try {
        const electronResult = await copyViaElectronClipboard(container);
        if (electronResult) {
          copied = electronResult.success;
          if (!electronResult.success) {
            console.warn(
              "[WeMD] Electron clipboard bridge unavailable, fallback to browser copy chain",
              electronResult.error || "unknown error",
            );
          }
        }
      } catch (e) {
        console.error("Electron clipboard 写入失败，降级为浏览器复制链路", e);
      }
    }

    if (!copied && preferElectronClipboard) {
      copied = copyViaNativeExecCommand(container);
    }

    // 最后回退到 Clipboard API
    if (!copied && navigator.clipboard && window.ClipboardItem) {
      console.warn(
        "[WeMD] native execCommand copy unavailable, fallback to Clipboard API",
      );
      try {
        const blob = new Blob([container.innerHTML], { type: "text/html" });
        const textBlob = new Blob([getRenderedPlainText(container)], {
          type: "text/plain",
        });
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": blob,
            "text/plain": textBlob,
          }),
        ]);
        copied = true;
      } catch (e) {
        console.error("Clipboard API 失败，使用回退方案", e);
      }
    }

    if (!copied) {
      throw new Error("浏览器剪贴板写入失败");
    }

    toast.success("已复制，可以直接粘贴至微信公众号", {
      duration: 3000,
      icon: "✅",
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("复制失败详情:", error);
    toast.error(`复制失败: ${errorMsg}`);
    throw error;
  } finally {
    document.body.removeChild(container);
  }
}
