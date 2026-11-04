/**
 * 微信公众号复制主编排入口
 * 负责将 Markdown 转为微信兼容 HTML 并写入剪贴板
 */

import toast from "react-hot-toast";
import { processHtml, createMarkdownParser } from "@wemd/core";
import katexCss from "katex/dist/katex.min.css?raw";
import { convertLinksToFootnotes } from "../utils/linkFootnote";
import { getPublishingPreference } from "../store/publishingPreferences";
import {
  applyLightRootVars,
  resolveInlineStyleVariablesForCopy,
} from "./inlineStyleVarResolver";
import {
  materializeCounterPseudoContent,
  stripCounterPseudoRules,
} from "./wechatCounterCompat";
import { expandCSSVariables } from "./cssVariableExpander";
import {
  normalizeCopyContainer,
  stripCopyMetadata,
} from "./wechatCopyNormalizer";
import {
  renderHighRiskMathAsImages,
  stripHiddenMathMarkupForWechat,
  type MathImageRenderResult,
} from "./wechatMathCompat";
import { renderMermaidBlocks } from "./wechatMermaidRenderer";
import { renderTableBlocks } from "./wechatTableRenderer";
import { getDesktop } from "../lib/platformAdapter";

// re-export 保持外部引用兼容
export { normalizeCopyContainer, stripCopyMetadata };

interface CopyToWechatOptions {
  showMacBar?: boolean;
}

export interface WechatContainerOptions extends CopyToWechatOptions {
  /** 渲染宽度：复制沿用 760px，长图用手机宽度 */
  width?: string;
  /** 不传时沿用用户的表格换行偏好 */
  tableWrap?: boolean;
}

export interface RenderedWechatContainer {
  container: HTMLDivElement;
  requiresExactHtmlTransport: boolean;
  mathFallback: MathImageRenderResult;
}

const buildCopyCss = (themeCss: string) => {
  if (!themeCss) return katexCss;
  // 复制前展开 CSS 变量为具体值，消除微信清洗 var() 导致的样式丢失
  const expandedCss = expandCSSVariables(themeCss);
  return `${expandedCss}\n${katexCss}`;
};

// 微信不转存 45×13 这类小尺寸 data: URI，保存草稿时会被剥离（#91），故改用托管外链。
// Mermaid、公式等较大的 data: URI 不受此限制。
const MAC_SIGN_IMAGE_URL = "https://img.wemd.app/1785143461387_dwk0yi.svg";

const renderMacSignDotsToImages = (container: HTMLElement): void => {
  container.querySelectorAll<HTMLElement>(".mac-sign").forEach((macSign) => {
    const dots = Array.from(macSign.querySelectorAll<HTMLElement>(".mac-dot"));
    if (dots.length === 0) return;

    const dotMetrics = dots.map((dot) => ({
      height: Number.parseFloat(dot.style.height),
      marginRight: Number.parseFloat(dot.style.marginRight) || 0,
      marginTop: Number.parseFloat(dot.style.marginTop) || 0,
      width: Number.parseFloat(dot.style.width),
    }));
    const width = dotMetrics.reduce(
      (total, dot) => total + dot.width + dot.marginRight,
      0,
    );
    const height =
      Number.parseFloat(macSign.style.height) ||
      Math.max(...dotMetrics.map((dot) => dot.marginTop + dot.height));
    if (!width || !height) {
      console.warn("Mac Bar 圆点尺寸推导失败，保留 HTML 圆点", {
        height,
        width,
      });
      return;
    }

    const image = document.createElement("img");
    image.src = MAC_SIGN_IMAGE_URL;
    image.alt = "";
    image.width = width;
    image.height = height;
    image.style.display = "block";
    image.style.setProperty("width", `${width}px`, "important");
    image.style.setProperty("height", `${height}px`, "important");
    image.style.setProperty("max-width", `${width}px`, "important");
    image.style.setProperty("max-height", `${height}px`, "important");

    macSign.removeAttribute("aria-hidden");
    macSign.replaceChildren(image);
  });
};

/**
 * 将 HTML 中的 checkbox 转换为 emoji
 * 微信公众号会过滤 <input> 标签，需要转为 emoji 替代
 */
const convertCheckboxesToEmoji = (html: string): string => {
  // 使用 &nbsp; 确保空格不被微信吞掉
  let result = html.replace(/<input[^>]*checked[^>]*>/gi, "✅&nbsp;");
  result = result.replace(
    /<input[^>]*type=["']checkbox["'][^>]*>/gi,
    "⬜&nbsp;",
  );
  return result;
};

// ── 剪贴板写入策略 ─────────────────────────────────

const getRenderedPlainText = (container: HTMLElement): string => {
  const innerText = container.innerText;
  if (typeof innerText === "string" && innerText.trim().length > 0) {
    return innerText;
  }
  return container.textContent || "";
};

const copyViaNativeExecCommand = (
  container: HTMLElement,
  exactHtmlTransport: boolean,
): boolean => {
  const html = exactHtmlTransport ? container.innerHTML : "";
  const text = exactHtmlTransport ? getRenderedPlainText(container) : "";
  const selection = window.getSelection();
  if (!selection) return false;

  const previousRanges = Array.from(
    { length: selection.rangeCount },
    (_, index) => selection.getRangeAt(index).cloneRange(),
  );
  const previousActiveElement =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  const previousTextControlSelection =
    previousActiveElement instanceof HTMLInputElement ||
    previousActiveElement instanceof HTMLTextAreaElement
      ? {
          start: previousActiveElement.selectionStart,
          end: previousActiveElement.selectionEnd,
          direction: previousActiveElement.selectionDirection,
        }
      : null;
  let payloadWritten = false;
  let copyEventObserved = false;
  const handleCopy = (event: Event) => {
    copyEventObserved = true;
    if (!exactHtmlTransport) return;

    const clipboardEvent = event as ClipboardEvent;
    if (!clipboardEvent.clipboardData) return;

    try {
      clipboardEvent.clipboardData.setData("text/html", html);
      clipboardEvent.clipboardData.setData("text/plain", text);
      clipboardEvent.preventDefault();
      payloadWritten = true;
    } catch {
      payloadWritten = false;
    }
  };

  document.addEventListener("copy", handleCopy, true);
  try {
    const range = document.createRange();
    range.selectNodeContents(container);
    selection.removeAllRanges();
    selection.addRange(range);

    // 普通主题沿用浏览器选区序列化；连续背景则只认 copy handler 的精确写入结果。
    const commandSucceeded = document.execCommand("copy");
    return exactHtmlTransport
      ? payloadWritten
      : commandSucceeded && copyEventObserved;
  } catch {
    return false;
  } finally {
    document.removeEventListener("copy", handleCopy, true);

    if (previousActiveElement?.isConnected) {
      try {
        if (document.activeElement !== previousActiveElement) {
          previousActiveElement.focus({ preventScroll: true });
        }
        if (
          previousTextControlSelection &&
          (previousActiveElement instanceof HTMLInputElement ||
            previousActiveElement instanceof HTMLTextAreaElement) &&
          previousTextControlSelection.start !== null &&
          previousTextControlSelection.end !== null
        ) {
          previousActiveElement.setSelectionRange(
            previousTextControlSelection.start,
            previousTextControlSelection.end,
            previousTextControlSelection.direction ?? undefined,
          );
        }
      } catch {
        // 原焦点节点不再支持恢复时继续完成剪贴板回退。
      }
    }

    selection.removeAllRanges();
    previousRanges.forEach((previousRange) => {
      try {
        selection.addRange(previousRange);
      } catch {
        // 原选区节点已移除时保持空选区，避免复制流程继续失败。
      }
    });
  }
};

const copyViaDesktopClipboard = async (
  container: HTMLElement,
): Promise<{ success: boolean; error?: string } | null> => {
  const writeHTML = getDesktop()?.clipboard?.writeHTML;
  if (!writeHTML) return null;

  return writeHTML({
    html: container.innerHTML,
    text: getRenderedPlainText(container),
  });
};

const shouldPreferDesktopClipboard = (): boolean => {
  const desktop = getDesktop();
  if (!desktop) return false;

  // Windows 下优先使用与手动复制一致的选区链路，降低公众号样式丢失概率
  if (desktop.platform === "win32") return false;
  if (desktop.platform === "darwin" || desktop.platform === "linux")
    return true;
  return false;
};

// ── 主编排流程 ──────────────────────────────────────

/**
 * 渲染复制与长图共用的最终 HTML 容器（已挂到 body、离屏、强制亮色）。
 * 调用方负责在用完后移除 container。
 */
export async function renderWechatContainer(
  markdown: string,
  css: string,
  options: WechatContainerOptions = {},
): Promise<RenderedWechatContainer> {
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.top = "0";
  container.style.left = "0";
  container.style.width = options.width ?? "760px";
  container.style.opacity = "0";
  container.style.pointerEvents = "none";
  container.style.zIndex = "-1";
  container.style.contain = "layout style paint";
  // 强制亮色模式，防止暗色 UI 下 execCommand("copy") 序列化出亮色文字
  container.style.colorScheme = "light";
  container.style.color = "#000000";
  applyLightRootVars(container);
  document.body.appendChild(container);

  try {
    const parser = createMarkdownParser({
      mathRenderer: "katex",
      showMacBar: options.showMacBar === true,
    });
    const rawHtml = parser.render(markdown);
    const themedCss = buildCopyCss(css);
    const sanitizedCss = stripCounterPseudoRules(themedCss);
    const sourceHtml = getPublishingPreference("linkToFootnote")
      ? convertLinksToFootnotes(rawHtml)
      : rawHtml;
    const materializedHtml = materializeCounterPseudoContent(
      sourceHtml,
      themedCss,
    );
    const styledHtml = processHtml(materializedHtml, sanitizedCss, true, true);
    const resolvedHtml = resolveInlineStyleVariablesForCopy(styledHtml);
    const finalHtml = convertCheckboxesToEmoji(resolvedHtml);

    container.innerHTML = finalHtml;
    const mathFallback = await renderHighRiskMathAsImages(container);
    stripHiddenMathMarkupForWechat(container);
    await renderMermaidBlocks(container);
    await renderTableBlocks(
      container,
      options.tableWrap ?? getPublishingPreference("tableWrap"),
    );
    renderMacSignDotsToImages(container);
    const { requiresExactHtmlTransport } = normalizeCopyContainer(container);
    return { container, requiresExactHtmlTransport, mathFallback };
  } catch (error) {
    container.remove();
    throw error;
  }
}

export async function copyToWechat(
  markdown: string,
  css: string,
  options: CopyToWechatOptions = {},
): Promise<void> {
  let container: HTMLDivElement | null = null;

  try {
    const rendered = await renderWechatContainer(markdown, css, options);
    container = rendered.container;
    const { requiresExactHtmlTransport, mathFallback } = rendered;

    let copied = false;

    const preferDesktopClipboard = shouldPreferDesktopClipboard();

    if (!preferDesktopClipboard) {
      copied = copyViaNativeExecCommand(container, requiresExactHtmlTransport);
    }

    if (!copied && getDesktop()) {
      try {
        const desktopResult = await copyViaDesktopClipboard(container);
        if (desktopResult) {
          copied = desktopResult.success;
          if (!desktopResult.success) {
            console.warn(
              "[WeMD] desktop clipboard bridge unavailable, fallback to browser copy chain",
              desktopResult.error || "unknown error",
            );
          }
        }
      } catch (e) {
        console.error("桌面端剪贴板写入失败，降级为浏览器复制链路", e);
      }
    }

    if (!copied && preferDesktopClipboard) {
      copied = copyViaNativeExecCommand(container, requiresExactHtmlTransport);
    }

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

    toast.success(
      mathFallback.fallbackCount > 0
        ? `已复制，${mathFallback.fallbackCount} 个公式已降级为源码`
        : mathFallback.imageCount > 0
          ? "已复制，部分复杂公式已自动保真处理"
          : "已复制，可以直接粘贴至微信公众号",
      {
        duration: 3000,
      },
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("复制失败详情:", error);
    toast.error(`复制失败: ${errorMsg}`);
    throw error;
  } finally {
    container?.remove();
  }
}
