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

import highlightjs from "./utils/langHighlight";

export interface MarkdownParserOptions {
  showMacBar?: boolean;
  mathRenderer?: "auto" | "katex";
}

const MAC_CODE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" version="1.1" x="0px" y="0px" width="45px" height="13px" viewBox="0 0 450 130">
  <ellipse cx="50" cy="65" rx="50" ry="52" stroke="rgb(220,60,54)" stroke-width="2" fill="rgb(237,108,96)" />
  <ellipse cx="225" cy="65" rx="50" ry="52" stroke="rgb(218,151,33)" stroke-width="2" fill="rgb(247,193,81)" />
  <ellipse cx="400" cy="65" rx="50" ry="52" stroke="rgb(27,161,37)" stroke-width="2" fill="rgb(100,200,86)" />
</svg>
`.trim();

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
          const formatted = highlightjs.highlight(lang, str, true).value;
          const macSign = showMacBar
            ? `<span class="mac-sign" style="padding: 10px 14px 0;">${MAC_CODE_SVG}</span>`
            : "";
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
      const macSign = showMacBar
        ? `<span class="mac-sign" style="padding: 10px 14px 0;">${MAC_CODE_SVG}</span>`
        : "";
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

  return markdownParser;
};
