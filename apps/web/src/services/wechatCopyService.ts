import toast from "react-hot-toast";
import { processHtml, createMarkdownParser } from "@wemd/core";
import katexCss from "katex/dist/katex.min.css?raw";
import { loadMathJax } from "../utils/mathJaxLoader";
import { hasMathFormula } from "../utils/katexRenderer";
import { convertLinksToFootnotes } from "../utils/linkFootnote";
import { getLinkToFootnoteEnabled } from "../components/Editor/ToolbarState";

const buildCopyCss = (themeCss: string) => {
  if (!themeCss) return katexCss;
  return `${themeCss}\n${katexCss}`;
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

    container.innerHTML = styledHtml;

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
