import toast from "react-hot-toast";
import {
  renderWechatContainer,
  type WechatContainerOptions,
} from "./wechatCopyService";

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);

const isExecutableUrl = (value: string) => {
  const normalized = value.replace(/\s+/g, "").toLowerCase();
  return (
    normalized.startsWith("javascript:") ||
    normalized.startsWith("vbscript:") ||
    normalized.startsWith("data:text/html")
  );
};

const URL_ATTRIBUTES: Record<string, true> = {
  href: true,
  src: true,
  "xlink:href": true,
  action: true,
  formaction: true,
  poster: true,
  data: true,
};

/** 下载的 HTML 会被直接打开，移除 Markdown 里可能夹带的可执行内容 */
export function sanitizeExportHtml(html: string): string {
  const container = document.createElement("div");
  container.innerHTML = html;

  container
    .querySelectorAll("script, iframe, object, embed")
    .forEach((node) => node.remove());
  container.querySelectorAll("*").forEach((element) => {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      if (name.startsWith("on") || name === "srcdoc") {
        element.removeAttribute(attribute.name);
        continue;
      }
      if (URL_ATTRIBUTES[name] && isExecutableUrl(attribute.value)) {
        element.removeAttribute(attribute.name);
      }
    }
  });

  return container.innerHTML;
}

export function extractTitle(root: ParentNode): string {
  const heading = root.querySelector("h1, h2");
  const content = heading?.querySelector(".content");
  return (content ?? heading)?.textContent?.trim() || "WeMD 导出";
}

/** 把复制链路渲染后的节点包成可直接打开的独立 HTML 文件 */
export function buildHtmlDocument(innerHtml: string, title: string): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="WeMD">
<title>${escapeHtml(title)}</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { padding: 24px 16px; }
  #wemd { max-width: 760px; margin: 0 auto; }
  #wemd img { max-width: 100%; height: auto; }
</style>
</head>
<body>
${innerHtml}
</body>
</html>
`;
}

const buildFileName = (title: string) =>
  `${title.replace(/[\\/:*?"<>|]/g, "_")}.html`;

export async function downloadHtml(
  markdown: string,
  css: string,
  options: Pick<WechatContainerOptions, "showMacBar"> = {},
): Promise<void> {
  let container: HTMLDivElement | null = null;
  try {
    const rendered = await renderWechatContainer(markdown, css, options);
    container = rendered.container;

    // 复制链路为适配微信会移除根节点 id，下载文件需要它来匹配主题样式
    const root = container.firstElementChild;
    if (root instanceof HTMLElement) root.id = "wemd";

    const title = extractTitle(container);
    const html = buildHtmlDocument(
      sanitizeExportHtml(container.innerHTML),
      title,
    );
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = buildFileName(title);
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("已开始下载 HTML");
  } catch (error) {
    console.error("下载 HTML 失败:", error);
    const message = error instanceof Error ? error.message : String(error);
    toast.error(`下载 HTML 失败: ${message}`);
  } finally {
    container?.remove();
  }
}
