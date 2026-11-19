import toast from "react-hot-toast";
import { getDesktop } from "../lib/platformAdapter";
import {
  renderWechatContainer,
  type WechatContainerOptions,
} from "./wechatCopyService";

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

export async function copyAsHtml(
  markdown: string,
  css: string,
  options: Pick<WechatContainerOptions, "showMacBar"> = {},
): Promise<void> {
  let container: HTMLDivElement | null = null;
  try {
    const rendered = await renderWechatContainer(markdown, css, options);
    container = rendered.container;
    const html = container.innerHTML;

    const copied =
      (await copyViaDesktopClipboard(html)) ||
      (await copyViaNavigatorClipboard(html)) ||
      copyViaExecCommand(html);

    if (copied) {
      toast.success("已复制带样式 HTML");
      return;
    }
    toast.error("复制 HTML 失败");
  } catch (error) {
    console.error("复制 HTML 失败:", error);
    toast.error("复制 HTML 失败");
  } finally {
    container?.remove();
  }
}
