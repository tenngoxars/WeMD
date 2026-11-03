import toast from "react-hot-toast";
import { createMarkdownParser } from "@wemd/core";
import { getDesktop } from "../lib/platformAdapter";

// 剥离 parser 为微信主题 CSS 注入的结构装饰（prefix/content/suffix span、<li><section>、空 <center>）。
// 外部编辑器不认这些 class，留着只会变成语义噪音。
export function sanitizeForExternalHtml(html: string): string {
  const doc = new DOMParser().parseFromString(
    `<body>${html}</body>`,
    "text/html",
  );
  const body = doc.body;

  body.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((h) => {
    const prefix = h.querySelector(":scope > span.prefix");
    const content = h.querySelector(":scope > span.content");
    const suffix = h.querySelector(":scope > span.suffix");
    if (prefix && content && suffix) {
      h.innerHTML = content.innerHTML;
    }
  });

  body.querySelectorAll("li").forEach((li) => {
    if (li.children.length === 1 && li.children[0].tagName === "SECTION") {
      const section = li.children[0] as HTMLElement;
      li.innerHTML = section.innerHTML;
    }
  });

  body.querySelectorAll("center").forEach((c) => {
    if (!c.textContent?.trim() && c.children.length === 0) {
      c.remove();
    }
  });

  return body.innerHTML;
}

const copyViaDesktopClipboard = async (text: string): Promise<boolean> => {
  const writeText = getDesktop()?.clipboard?.writeText;
  if (!writeText) return false;
  try {
    const result = await writeText(text);
    return result.success;
  } catch (error) {
    console.error("桌面端剪贴板写入失败:", error);
    return false;
  }
};

const copyViaNavigatorClipboard = async (text: string): Promise<boolean> => {
  if (!navigator.clipboard?.writeText) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error("Clipboard API 写入失败:", error);
    return false;
  }
};

const copyViaExecCommand = (text: string): boolean => {
  if (typeof document.execCommand !== "function") return false;
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);
  try {
    return document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
    window.getSelection()?.removeAllRanges();
  }
};

export async function copyAsHtml(markdown: string): Promise<void> {
  const parser = createMarkdownParser({
    showMacBar: false,
    mathRenderer: "katex",
  });
  const rawHtml = parser.render(markdown);
  const html = sanitizeForExternalHtml(rawHtml);

  const copied =
    (await copyViaDesktopClipboard(html)) ||
    (await copyViaNavigatorClipboard(html)) ||
    copyViaExecCommand(html);

  if (copied) {
    toast.success("已复制 HTML");
    return;
  }

  toast.error("复制 HTML 失败");
}
