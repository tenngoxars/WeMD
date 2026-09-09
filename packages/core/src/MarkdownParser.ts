// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./types/markdown-it-plugins.d.ts" />
import MarkdownIt from "markdown-it";
import markdownItDeflist from "markdown-it-deflist";
import markdownItImplicitFigures from "markdown-it-implicit-figures";
import markdownItTableOfContents from "markdown-it-table-of-contents";
import markdownItRuby from "markdown-it-ruby";
import markdownItMark from "markdown-it-mark";
import markdownItUnderline from "./plugins/markdown-it-underline";
import markdownItSub from "markdown-it-sub";
import markdownItSup from "markdown-it-sup";
import { full as markdownItEmoji } from "markdown-it-emoji";
import markdownItAttrs from "markdown-it-attrs";

// Local plugins

import markdownItMath from "./plugins/markdown-it-math";

import markdownItSpan from "./plugins/markdown-it-span";

import markdownItTableContainer from "./plugins/markdown-it-table-container";

import markdownItLinkfoot from "./plugins/markdown-it-linkfoot";

import markdownItImageFlow from "./plugins/markdown-it-imageflow";

import markdownItMultiquote from "./plugins/markdown-it-multiquote";

import markdownItLiReplacer from "./plugins/markdown-it-li";

import markdownItGitHubAlert from "./plugins/markdown-it-github-alert";
import markdownItTaskLists from "markdown-it-task-lists";
import markdownItCheckboxEmoji from "./plugins/markdown-it-checkbox-emoji";
import markdownItAttributePolicy from "./plugins/markdown-it-attribute-policy";
import markdownItSourcePosition from "./plugins/markdown-it-source-position";

import highlightjs from "./utils/langHighlight";

export interface MarkdownParserOptions {
  showMacBar?: boolean;
  mathRenderer?: "auto" | "katex";
  includeSourcePosition?: boolean;
}

const MAC_CODE_DOTS = ["rgb(237,108,96)", "rgb(247,193,81)", "rgb(100,200,86)"]
  .map(
    (color, index) =>
      `<span class="mac-dot" style="display:inline-block;width:10px;height:10px;margin-top:1.5px;${index < 2 ? "margin-right:7.5px;" : ""}border-radius:50%;background:${color};"></span>`,
  )
  .join("");

const renderMacSign = (): string =>
  `<span class="mac-sign" aria-hidden="true" style="display:block;height:13px;padding:10px 14px 0;line-height:0;">${MAC_CODE_DOTS}</span>`;

export const createMarkdownParser = (options: MarkdownParserOptions = {}) => {
  const showMacBar = options.showMacBar === true;
  const markdownParser: MarkdownIt = new MarkdownIt({
    html: true,
    highlight: (str: string, lang: string): string => {
      // Mermaid 图表：输出 pre.mermaid 让前端渲染
      if (lang === "mermaid") {
        const escaped = markdownParser.utils.escapeHtml(str);
        return `<pre class="mermaid">\n${escaped}\n</pre>\n`;
      }

      if (lang === undefined || lang === "") {
        lang = "bash";
      }
      // 加上custom则表示自定义样式，而非微信专属，避免被remove pre
      if (lang && highlightjs.getLanguage(lang)) {
        try {
          const formatted = highlightjs.highlight(str, {
            language: lang,
          }).value;
          const macSign = showMacBar ? renderMacSign() : "";
          return (
            '<pre class="custom">' +
            macSign +
            '<code class="hljs">' +
            formatted +
            "</code></pre>"
          );
        } catch {
          // Ignore highlight errors
        }
      }
      const macSign = showMacBar ? renderMacSign() : "";
      return (
        '<pre class="custom">' +
        macSign +
        '<code class="hljs">' +
        markdownParser.utils.escapeHtml(str) +
        "</code></pre>"
      );
    },
  });

  markdownParser
    .use(markdownItAttrs, {
      allowedAttributes: ["class", "id", /^data-[\w-]+$/],
    })
    .use(markdownItAttributePolicy)
    .use(markdownItSpan)
    .use(markdownItTableContainer)
    .use(markdownItMath, {
      renderer: options.mathRenderer ?? "auto",
    })
    .use(markdownItLinkfoot)
    .use(markdownItTableOfContents, {
      transformLink: () => "",
      includeLevel: [2, 3],
      markerPattern: /^\[toc\]/im,
    })
    .use(markdownItRuby)
    .use(markdownItImplicitFigures, { figcaption: true })
    .use(markdownItDeflist)
    .use(markdownItLiReplacer)
    .use(markdownItImageFlow)
    .use(markdownItMultiquote)
    .use(markdownItMark)
    .use(markdownItUnderline)
    .use(markdownItSub)
    .use(markdownItSup)
    .use(markdownItEmoji)
    .use(markdownItGitHubAlert)
    .use(markdownItTaskLists, {
      enabled: true,
      label: true,
      labelAfter: true,
    })
    .use(markdownItCheckboxEmoji);

  if (options.includeSourcePosition) {
    markdownParser.use(markdownItSourcePosition);
  }

  return markdownParser;
};
