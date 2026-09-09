import { execFile as execFileCallback } from "node:child_process";
import { readFile } from "node:fs/promises";
import { basename, join, parse } from "node:path";
import { promisify } from "node:util";
import { CliError } from "./index.js";
import {
  atomicWrite,
  renderArticleForCopy,
  writeRenderReport,
  type RenderOptions,
  type RenderResult,
} from "./render.js";

const execFile = promisify(execFileCallback);

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const conciseError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, " ").slice(0, 500);
};

const statusItem = (
  label: string,
  value: string,
  tone: "ready" | "warning" | "blocked" | "neutral" = "neutral",
): string =>
  `<li data-wemd-copy-detail data-tone="${tone}"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value)}</span></li>`;

const warningList = (warnings: string[], errors: string[]): string => {
  const items = [
    ...errors.map(
      (message) =>
        `<li data-wemd-copy-risk data-tone="blocked">${escapeHtml(message)}</li>`,
    ),
    ...warnings.map(
      (message) =>
        `<li data-wemd-copy-risk data-tone="warning">${escapeHtml(message)}</li>`,
    ),
  ];
  return items.length > 0
    ? `<ul data-wemd-copy-risks>${items.join("")}</ul>`
    : "<p data-wemd-copy-empty>未发现发布警告。</p>";
};

export const copyPageDocument = (
  title: string,
  fragment: string,
  result: RenderResult,
): string => {
  const exact = result.copy.requiresExactHtmlTransport;
  const blocked = result.errors.length > 0;
  const imageWarnings = result.compatibility.images.warnings;
  const imageErrors = result.compatibility.images.errors;
  const mermaidWarnings = result.compatibility.mermaid.warnings;
  const formulaRisk = result.compatibility.math.status === "warning";
  const transport = exact
    ? "copy 事件精确传输，Clipboard API 回退"
    : "WeMD 原生选区复制，Clipboard API 回退";
  const details = [
    statusItem("主题", result.theme.reference, "ready"),
    statusItem("主题指纹", result.theme.fingerprint, "neutral"),
    statusItem(
      "图片",
      imageErrors.length > 0
        ? imageErrors.join("；")
        : imageWarnings.length > 0
          ? imageWarnings.join("；")
          : `${result.stats.images} 张，未发现本地或不安全图片`,
      imageErrors.length > 0
        ? "blocked"
        : imageWarnings.length > 0
          ? "warning"
          : "ready",
    ),
    statusItem(
      "Mermaid",
      mermaidWarnings.length > 0
        ? mermaidWarnings.join("；")
        : result.stats.mermaid > 0
          ? `${result.stats.mermaid} 个图表已在生成期转为图片`
          : "未发现 Mermaid 图表",
      mermaidWarnings.length > 0 ? "warning" : "ready",
    ),
    statusItem(
      "数学公式",
      formulaRisk
        ? `${result.compatibility.math.complex} 个复杂公式仍为高风险 KaTeX DOM，当前结果不保证公众号兼容`
        : result.compatibility.math.total > 0
          ? `${result.compatibility.math.total} 个公式已完成兼容处理`
          : "未发现数学公式",
      formulaRisk ? "warning" : "ready",
    ),
    statusItem(
      "严格模式",
      result.compatibility.strict.enabled
        ? blocked
          ? result.compatibility.strict.errors.join("；")
          : "已启用并通过"
        : "未启用",
      blocked
        ? "blocked"
        : result.compatibility.strict.enabled
          ? "ready"
          : "neutral",
    ),
    statusItem("复制传输策略", transport, "neutral"),
  ].join("");

  return `<!doctype html>
<html lang="zh-CN" data-wemd-exact-html="${exact ? "true" : "false"}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; font-src https: data:; base-uri 'none'; form-action 'none'">
  <title>${escapeHtml(title)} · WeMD 可复制页面</title>
  <style>
    body[data-wemd-copy-page] { margin: 0; color: #1f2924; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    [data-wemd-copy-shell] { min-height: 100vh; overflow: auto; background: #eef1ee; }
    [data-wemd-copy-ui] { position: sticky; top: 0; z-index: 10; box-sizing: border-box; width: 100%; padding: 18px 24px; border-bottom: 1px solid #d8dfda; background: rgba(255,255,255,.97); box-shadow: 0 8px 24px rgba(31,41,36,.08); }
    [data-wemd-copy-ui-row] { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; justify-content: space-between; max-width: 1040px; margin: 0 auto; }
    [data-wemd-copy-ui-title] { margin: 0; font-size: 18px; line-height: 1.4; }
    [data-wemd-copy-ui-subtitle] { margin: 4px 0 0; color: #66726c; font-size: 13px; }
    [data-wemd-copy-button] { appearance: none; border: 0; border-radius: 10px; padding: 12px 20px; background: #087f5b; color: #fff; font-size: 15px; font-weight: 700; cursor: pointer; }
    [data-wemd-copy-button]:hover { background: #066649; }
    [data-wemd-copy-button]:focus-visible { outline: 3px solid rgba(8,127,91,.25); outline-offset: 3px; }
    [data-wemd-copy-button]:disabled { background: #9aa49f; cursor: not-allowed; }
    [data-wemd-copy-status] { max-width: 1040px; margin: 12px auto 0; padding: 10px 12px; border-radius: 8px; background: #edf7f2; color: #185c45; font-size: 14px; }
    [data-wemd-copy-status][data-tone="working"] { background: #fff5d6; color: #6d5100; }
    [data-wemd-copy-status][data-tone="error"] { background: #fff0f0; color: #9f2424; }
    [data-wemd-copy-details] { display: grid; grid-template-columns: repeat(auto-fit,minmax(240px,1fr)); gap: 8px; max-width: 1040px; margin: 14px auto 0; padding: 0; list-style: none; }
    [data-wemd-copy-detail] { display: grid; gap: 3px; padding: 10px 12px; border: 1px solid #e1e6e3; border-radius: 8px; background: #fafcfb; font-size: 12px; overflow-wrap: anywhere; }
    [data-wemd-copy-detail] strong { font-size: 12px; color: #536059; }
    [data-wemd-copy-detail][data-tone="warning"] { border-color: #e6c45f; background: #fffaf0; }
    [data-wemd-copy-detail][data-tone="blocked"] { border-color: #e39191; background: #fff5f5; }
    [data-wemd-copy-risks] { max-width: 1040px; margin: 12px auto 0; padding: 0; list-style: none; }
    [data-wemd-copy-risk] { margin-top: 6px; padding: 8px 10px; border-radius: 7px; font-size: 13px; }
    [data-wemd-copy-risk][data-tone="warning"] { background: #fff5d6; color: #6d5100; }
    [data-wemd-copy-risk][data-tone="blocked"] { background: #fff0f0; color: #9f2424; }
    [data-wemd-copy-empty] { max-width: 1040px; margin: 12px auto 0; color: #66726c; font-size: 13px; }
    [data-wemd-copy-guidance] { max-width: 1040px; margin: 12px auto 0; color: #536059; font-size: 13px; }
    [data-wemd-preview] { box-sizing: border-box; width: min(100% - 32px, 820px); min-height: 600px; margin: 32px auto; padding: 30px; overflow: hidden; background: #fff; box-shadow: 0 14px 42px rgba(31,41,36,.12); }
    [data-wemd-copy-host] { position: fixed; top: 0; left: 0; width: 760px; opacity: 0; pointer-events: none; z-index: -1; contain: layout style paint; color-scheme: light; color: #000; }
    @media (max-width: 640px) { [data-wemd-copy-ui] { padding: 14px 16px; } [data-wemd-preview] { width: 100%; margin: 18px 0; padding: 16px; } }
  </style>
</head>
<body data-wemd-copy-page>
  <div data-wemd-copy-shell>
    <header data-wemd-copy-ui>
      <div data-wemd-copy-ui-row>
        <div>
          <h1 data-wemd-copy-ui-title>${escapeHtml(title)}</h1>
          <p data-wemd-copy-ui-subtitle>检查排版后点击复制，再到微信公众号后台粘贴。</p>
        </div>
        <button type="button" data-wemd-copy-button${blocked ? " disabled" : ""}>复制到公众号</button>
      </div>
      <div role="status" aria-live="polite" data-wemd-copy-status${blocked ? ' data-tone="error"' : ""}>${blocked ? "存在阻断性错误，当前不可复制。" : "页面已就绪，尚未写入系统剪贴板。"}</div>
      <ul data-wemd-copy-details>${details}</ul>
      ${warningList(result.warnings, result.errors)}
      <p data-wemd-copy-guidance>复制成功仅表示系统剪贴板写入成功。请在公众号后台粘贴、检查、保存草稿，并重新打开草稿确认最终效果。</p>
    </header>
    <main data-wemd-preview>${fragment}</main>
  </div>
  <div aria-hidden="true" data-wemd-copy-host></div>
  <script>
    (() => {
      "use strict";
      const button = document.querySelector("[data-wemd-copy-button]");
      const status = document.querySelector("[data-wemd-copy-status]");
      const preview = document.querySelector("[data-wemd-preview]");
      const copyHost = document.querySelector("[data-wemd-copy-host]");
      const exactHtmlTransport = document.documentElement.dataset.wemdExactHtml === "true";

      const setStatus = (message, tone) => {
        status.textContent = message;
        if (tone) status.dataset.tone = tone;
        else delete status.dataset.tone;
      };

      const renderedPlainText = (container) => {
        const innerText = container.innerText;
        return typeof innerText === "string" && innerText.trim().length > 0
          ? innerText
          : container.textContent || "";
      };

      const copyBySelection = (container) => {
        const html = exactHtmlTransport ? container.innerHTML : "";
        const text = exactHtmlTransport ? renderedPlainText(container) : "";
        const selection = window.getSelection();
        if (!selection || typeof document.execCommand !== "function") return null;
        const previousRanges = Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index).cloneRange());
        const previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const previousTextControlSelection = previousActiveElement instanceof HTMLInputElement || previousActiveElement instanceof HTMLTextAreaElement
          ? { start: previousActiveElement.selectionStart, end: previousActiveElement.selectionEnd, direction: previousActiveElement.selectionDirection }
          : null;
        let payloadWritten = false;
        let copyEventObserved = false;
        const handleCopy = (event) => {
          copyEventObserved = true;
          if (!exactHtmlTransport || !event.clipboardData) return;
          try {
            event.clipboardData.setData("text/html", html);
            event.clipboardData.setData("text/plain", text);
            event.preventDefault();
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
          const commandSucceeded = document.execCommand("copy");
          if (exactHtmlTransport && payloadWritten) return "exact-html-event";
          if (!exactHtmlTransport && commandSucceeded && copyEventObserved) return "selection";
          return null;
        } catch {
          return null;
        } finally {
          document.removeEventListener("copy", handleCopy, true);
          if (previousActiveElement?.isConnected) {
            try {
              if (document.activeElement !== previousActiveElement) previousActiveElement.focus({ preventScroll: true });
              if (previousTextControlSelection && (previousActiveElement instanceof HTMLInputElement || previousActiveElement instanceof HTMLTextAreaElement) && previousTextControlSelection.start !== null && previousTextControlSelection.end !== null) {
                previousActiveElement.setSelectionRange(previousTextControlSelection.start, previousTextControlSelection.end, previousTextControlSelection.direction || undefined);
              }
            } catch {}
          }
          selection.removeAllRanges();
          previousRanges.forEach((range) => { try { selection.addRange(range); } catch {} });
        }
      };

      const copyByClipboardApi = async (container) => {
        if (!navigator.clipboard || !window.ClipboardItem) return false;
        try {
          await navigator.clipboard.write([new ClipboardItem({
            "text/html": new Blob([container.innerHTML], { type: "text/html" }),
            "text/plain": new Blob([renderedPlainText(container)], { type: "text/plain" })
          })]);
          return true;
        } catch {
          return false;
        }
      };

      button?.addEventListener("click", async () => {
        const article = preview.firstElementChild;
        if (!article) {
          setStatus("复制失败：页面中没有可复制正文", "error");
          return;
        }
        button.disabled = true;
        setStatus("正在准备复制……", "working");
        copyHost.replaceChildren(article.cloneNode(true));
        try {
          const nativeResult = copyBySelection(copyHost);
          if (nativeResult === "selection") {
            setStatus("复制成功：使用 WeMD 原生选区链路", "success");
            return;
          }
          if (nativeResult === "exact-html-event") {
            setStatus("复制成功：使用 WeMD copy 事件精确传输链路", "success");
            return;
          }
          if (await copyByClipboardApi(copyHost)) {
            setStatus("复制成功：使用 Clipboard API 回退链路", "success");
            return;
          }
          setStatus("复制失败：浏览器拒绝剪贴板操作", "error");
        } finally {
          copyHost.replaceChildren();
          button.disabled = false;
        }
      });
    })();
  </script>
</body>
</html>
`;
};

export type OpenRunner = (command: string, args: string[]) => Promise<void>;

const defaultOpenRunner: OpenRunner = async (command, args) => {
  await execFile(command, args, {
    timeout: 10_000,
    windowsHide: true,
  });
};

export const openCommand = (
  path: string,
  platform: NodeJS.Platform = process.platform,
): { command: string; args: string[]; display: string } | null => {
  if (platform === "darwin") {
    return {
      command: "open",
      args: [path],
      display: `open ${JSON.stringify(path)}`,
    };
  }
  if (platform === "win32") {
    return {
      command: "explorer.exe",
      args: [path],
      display: `explorer.exe ${JSON.stringify(path)}`,
    };
  }
  if (platform === "linux") {
    return {
      command: "xdg-open",
      args: [path],
      display: `xdg-open ${JSON.stringify(path)}`,
    };
  }
  return null;
};

export async function openCopyPage(
  path: string,
  platform: NodeJS.Platform = process.platform,
  runner: OpenRunner = defaultOpenRunner,
): Promise<{ status: "opened" } | { status: "failed"; error: string }> {
  const command = openCommand(path, platform);
  if (!command) {
    return { status: "failed", error: `当前平台不支持自动打开：${platform}` };
  }
  try {
    await runner(command.command, command.args);
    return { status: "opened" };
  } catch (error) {
    return { status: "failed", error: conciseError(error) };
  }
}

export async function createCopyPage(
  options: RenderOptions,
  shouldOpen: boolean,
): Promise<RenderResult> {
  const result = await renderArticleForCopy(options);
  const fragment = await readFile(result.outputs.fragment, "utf8");
  const copyPath = join(
    parse(result.outputs.fragment).dir,
    `${parse(result.outputs.fragment).name.replace(/\.fragment$/, "")}.copy.html`,
  );
  const exact = result.copy.requiresExactHtmlTransport;
  result.outputs.copy = copyPath;
  result.copy = {
    status: result.errors.length > 0 ? "blocked" : "ready",
    requiresExactHtmlTransport: exact,
    preferredTransport: exact ? "exact-html-event" : "selection",
    fallbackTransport: "clipboard-api",
  };
  const title = parse(basename(result.inputPath)).name;
  try {
    await atomicWrite(
      copyPath,
      copyPageDocument(title, fragment.trim(), result),
    );
  } catch (error) {
    throw new CliError(
      `无法写入可复制页面：${error instanceof Error ? error.message : String(error)}`,
      6,
    );
  }
  result.open = shouldOpen
    ? await openCopyPage(copyPath)
    : { status: "not-requested" };
  await writeRenderReport(result);
  return result;
}
