// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./types/markdown-it-plugins.d.ts" />
import MarkdownIt from "markdown-it";
import markdownItDeflist from "markdown-it-deflist";
import markdownItImplicitFigures from "markdown-it-implicit-figures";
import markdownItTableOfContents from "markdown-it-table-of-contents";
import markdownItRuby from "markdown-it-ruby";
import markdownItMark from "markdown-it-mark";

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

import highlightjs from "./utils/langHighlight";

export const createMarkdownParser = () => {
  const markdownParser: MarkdownIt = new MarkdownIt({
    html: true,
    highlight: (str: string, lang: string): string => {
      if (lang === undefined || lang === "") {
        lang = "bash";
      }
      // 加上custom则表示自定义样式，而非微信专属，避免被remove pre
      if (lang && highlightjs.getLanguage(lang)) {
        try {
          const formatted = highlightjs.highlight(lang, str, true).value;
          return (
            '<pre class="custom"><code class="hljs">' +
            formatted +
            "</code></pre>"
          );
        } catch {
          // Ignore highlight errors
        }
      }
      return (
        '<pre class="custom"><code class="hljs">' +
        markdownParser.utils.escapeHtml(str) +
        "</code></pre>"
      );
    },
  });

  markdownParser
    .use(markdownItSpan)
    .use(markdownItTableContainer)
    .use(markdownItMath)
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
    .use(markdownItSub)
    .use(markdownItSup)
    .use(markdownItEmoji)
    .use(markdownItGitHubAlert)
    .use(markdownItTaskLists, {
      enabled: true,
      label: true,
      labelAfter: true,
    });

  return markdownParser;
};
