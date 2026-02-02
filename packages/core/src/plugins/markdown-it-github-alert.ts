/**
 * markdown-it-github-alert
 * 解析 GitHub 风格的 Alert 语法，支持自定义标题
 *
 * 语法：
 * > [!TIP]
 * > 内容
 *
 * > [!TIP] 自定义标题
 * > 内容
 *
 * > [!TIP] 仅自定义标题（无正文也生效）
 *
 * 支持类型：NOTE, TIP, IMPORTANT, WARNING, CAUTION
 */

import type MarkdownIt from "markdown-it";
import Token from "markdown-it/lib/token";
import StateCore from "markdown-it/lib/rules_core/state_core";

interface AlertConfig {
  type: string;
  label: string;
  icon: string;
  cssClass: string;
}

const ALERT_CONFIGS: AlertConfig[] = [
  { type: "NOTE", label: "备注", icon: "ℹ️", cssClass: "note" },
  { type: "TIP", label: "提示", icon: "💡", cssClass: "tip" },
  { type: "IMPORTANT", label: "重要", icon: "📌", cssClass: "important" },
  { type: "WARNING", label: "警告", icon: "⚠️", cssClass: "warning" },
  { type: "CAUTION", label: "危险", icon: "🚨", cssClass: "caution" },
];

const ALERT_PATTERN = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*/i;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function findAlertType(
  text: string,
): { config: AlertConfig; restContent: string } | null {
  const match = text.match(ALERT_PATTERN);
  if (!match) return null;
  const type = match[1].toUpperCase();
  const config = ALERT_CONFIGS.find((c) => c.type === type);
  if (!config) return null;
  const restContent = text.slice(match[0].length);
  return { config, restContent };
}

function findBreakIndex(children: Token[]): number {
  for (let k = 0; k < children.length; k++) {
    if (children[k].type === "softbreak" || children[k].type === "hardbreak") {
      return k;
    }
  }
  return -1;
}

export default function markdownItGitHubAlert(md: MarkdownIt): void {
  md.core.ruler.push("github-alert", (state: StateCore) => {
    const tokens = state.tokens;

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token.type !== "blockquote_open") continue;

      let closeIdx = -1;
      let depth = 1;
      for (let j = i + 1; j < tokens.length; j++) {
        if (tokens[j].type === "blockquote_open") depth++;
        if (tokens[j].type === "blockquote_close") {
          depth--;
          if (depth === 0) {
            closeIdx = j;
            break;
          }
        }
      }
      if (closeIdx === -1) continue;

      let firstInlineIdx = -1;
      let firstParagraphIdx = -1;
      for (let j = i + 1; j < closeIdx; j++) {
        if (tokens[j].type === "paragraph_open" && firstParagraphIdx === -1) {
          firstParagraphIdx = j;
        }
        if (tokens[j].type === "inline" && tokens[j].content) {
          firstInlineIdx = j;
          break;
        }
      }
      if (firstInlineIdx === -1) continue;

      const firstInline = tokens[firstInlineIdx];
      const alertResult = findAlertType(firstInline.content);
      if (!alertResult) continue;

      const { config: alertConfig, restContent } = alertResult;

      let customTitle: string | undefined;
      let bodyContent = restContent;

      const trimmedRest = restContent.trim();
      if (trimmedRest) {
        const newlineIdx = restContent.indexOf("\n");
        if (newlineIdx === -1) {
          customTitle = trimmedRest;
          bodyContent = "";
        } else {
          const firstLine = restContent.slice(0, newlineIdx).trim();
          if (firstLine) customTitle = firstLine;
          bodyContent = restContent.slice(newlineIdx + 1);
        }
      }

      token.type = "callout_open";
      token.tag = "section";
      token.attrSet("class", `callout callout-${alertConfig.cssClass}`);
      tokens[closeIdx].type = "callout_close";
      tokens[closeIdx].tag = "section";

      firstInline.content = bodyContent;

      let titleInserted = false;
      for (let j = i + 1; j < closeIdx; j++) {
        if (tokens[j].type === "paragraph_open") {
          const titleOpen = new Token("callout_title_open", "div", 1);
          titleOpen.attrSet("class", "callout-title");

          const titleContent = new Token("html_inline", "", 0);
          const displayLabel = customTitle
            ? escapeHtml(customTitle)
            : alertConfig.label;
          titleContent.content = `<span class="callout-icon">${alertConfig.icon}</span><span>${displayLabel}</span>`;

          const titleClose = new Token("callout_title_close", "div", -1);
          tokens.splice(j, 0, titleOpen, titleContent, titleClose);
          closeIdx += 3;
          titleInserted = true;
          break;
        }
      }

      if (firstInline.children && firstInline.children.length > 0) {
        if (!bodyContent.trim()) {
          firstInline.children = [];
          const paragraphOffset = titleInserted ? 3 : 0;
          const adjustedParagraphIdx = firstParagraphIdx + paragraphOffset;
          const adjustedInlineIdx = firstInlineIdx + paragraphOffset;
          if (
            firstParagraphIdx !== -1 &&
            tokens[adjustedInlineIdx + 1]?.type === "paragraph_close"
          ) {
            tokens.splice(adjustedParagraphIdx, 3);
          }
        } else if (customTitle) {
          const breakIdx = findBreakIndex(firstInline.children);
          if (breakIdx !== -1) {
            firstInline.children.splice(0, breakIdx + 1);
          } else {
            const firstChild = firstInline.children[0];
            if (firstChild.type === "text") {
              const childResult = findAlertType(firstChild.content);
              if (childResult) firstChild.content = childResult.restContent;
            }
          }
        } else {
          const firstChild = firstInline.children[0];
          if (firstChild.type === "text") {
            const childResult = findAlertType(firstChild.content);
            if (childResult) firstChild.content = childResult.restContent;
          }
        }
      }
    }
  });

  md.renderer.rules.callout_open = (tokens: Token[], idx: number) => {
    const token = tokens[idx];
    return `<section class="${token.attrGet("class") || "callout"}">\n`;
  };

  md.renderer.rules.callout_close = () => "</section>\n";

  md.renderer.rules.callout_title_open = (tokens: Token[], idx: number) => {
    const token = tokens[idx];
    return `<div class="${token.attrGet("class") || "callout-title"}">`;
  };

  md.renderer.rules.callout_title_close = () => "</div>\n";
}
