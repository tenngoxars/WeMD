import toast from "react-hot-toast";
import mermaid from "mermaid";
import { processHtml, createMarkdownParser } from "@wemd/core";
import katexCss from "katex/dist/katex.min.css?raw";
import { loadMathJax } from "../utils/mathJaxLoader";
import { hasMathFormula } from "../utils/katexRenderer";
import { convertLinksToFootnotes } from "../utils/linkFootnote";
import { getLinkToFootnoteEnabled } from "../components/Editor/ToolbarState";
import { useThemeStore } from "../store/themeStore";
import {
  getMermaidConfig,
  getThemedMermaidDiagram,
} from "../utils/mermaidConfig";

const buildCopyCss = (themeCss: string) => {
  if (!themeCss) return katexCss;
  return `${themeCss}\n${katexCss}`;
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
  const mermaidTheme = (designerVariables?.mermaidTheme as string) || "base";
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
    const sourceHtml = getLinkToFootnoteEnabled()
      ? convertLinksToFootnotes(rawHtml)
      : rawHtml;
    const styledHtml = processHtml(sourceHtml, themedCss, true, true);
    // 转换 checkbox 为 emoji，微信不支持 input 标签
    const finalHtml = convertCheckboxesToEmoji(styledHtml);

    container.innerHTML = finalHtml;

    await renderMermaidBlocks(container);

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(container);
    selection?.removeAllRanges();
    selection?.addRange(range);

    document.execCommand("copy");

    if (navigator.clipboard && window.ClipboardItem) {
      try {
        const blob = new Blob([container.innerHTML], { type: "text/html" });
        const textBlob = new Blob([markdown], { type: "text/plain" });
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": blob,
            "text/plain": textBlob,
          }),
        ]);
      } catch (e) {
        console.error("Clipboard API 失败，使用回退方案", e);
      }
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
