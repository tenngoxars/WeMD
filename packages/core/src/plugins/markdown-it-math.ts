import katex from "katex";
import MarkdownIt from "markdown-it";
import StateInline from "markdown-it/lib/rules_inline/state_inline";
import StateBlock from "markdown-it/lib/rules_block/state_block";
import Token from "markdown-it/lib/token";

const escapeHtml = (str: string) =>
  str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const escapeAttribute = (str: string) => escapeHtml(str).replace(/'/g, "&#39;");

type MathRenderer = "auto" | "katex";

const renderMathJax = (
  latex: string,
  display: boolean,
  renderer: MathRenderer,
): string | null => {
  if (renderer === "katex") return null;
  if (typeof window === "undefined") return null;
  const mathJax = window.MathJax;
  if (!mathJax || typeof mathJax.tex2svg !== "function") return null;

  try {
    if (typeof mathJax.texReset === "function") {
      mathJax.texReset();
    }
    const container = mathJax.tex2svg(latex, { display });
    const svg = container.querySelector("svg");
    if (!svg) return null;
    const width = svg.getAttribute("width") || svg.style.minWidth;
    svg.removeAttribute("width");
    svg.style.display = "initial";
    svg.style.setProperty("max-width", "300vw", "important");
    svg.style.flexShrink = "0";
    if (width) {
      svg.style.width = width;
    }
    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    return svg.outerHTML;
  } catch (error) {
    console.error("MathJax render error:", error);
    return null;
  }
};

/* 处理内联数学公式 */
/*
类似于 markdown-it-simplemath，这是一个精简版：
https://github.com/runarberg/markdown-it-math
区别在于它接受 (部分) LaTeX 作为输入并依赖 KaTeX 进行渲染。
*/
/* eslint-disable */

// 测试是否为潜在的开始或结束定界符
// 假设 state.src[pos] 处有 "$"
function isValidDelim(state: StateInline, pos: number) {
  var prevChar,
    nextChar,
    max = state.posMax,
    can_open = true,
    can_close = true;

  prevChar = pos > 0 ? state.src.charCodeAt(pos - 1) : -1;
  nextChar = pos + 1 <= max ? state.src.charCodeAt(pos + 1) : -1;

  // 检查开头和结尾的非空白条件，并且
  // 检查结束定界符后面没有跟数字
  if (
    prevChar === 0x20 /* " " */ ||
    prevChar === 0x09 /* \t */ ||
    (nextChar >= 0x30 /* "0" */ && nextChar <= 0x39) /* "9" */
  ) {
    can_close = false;
  }
  if (nextChar === 0x20 /* " " */ || nextChar === 0x09 /* \t */) {
    can_open = false;
  }

  return {
    can_open: can_open,
    can_close: can_close,
  };
}

function math_inline(state: StateInline, silent: boolean) {
  var start, match, token, res, pos;

  if (state.src[state.pos] !== "$") {
    return false;
  }

  res = isValidDelim(state, state.pos);
  if (!res.can_open) {
    if (!silent) {
      state.pending += "$";
    }
    state.pos += 1;
    return true;
  }

  // 首先检查并绕过所有正确转义的定界符
  // 这个循环假设第一个前导反引号不能是 state.src 中的第一个字符，
  // 因为我们已经找到了一个开始定界符。
  start = state.pos + 1;
  match = start;
  while ((match = state.src.indexOf("$", match)) !== -1) {
    // 发现潜在的 $，寻找转义，完成后 pos 将指向第一个非转义字符
    pos = match - 1;
    while (state.src[pos] === "\\") {
      pos -= 1;
    }

    // 偶数个转义符，发现潜在的结束定界符
    if ((match - pos) % 2 == 1) {
      break;
    }
    match += 1;
  }

  // 未找到结束定界符。消耗 $ 并继续。
  if (match === -1) {
    if (!silent) {
      state.pending += "$";
    }
    state.pos = start;
    return true;
  }

  // 检查空内容，即: $$。不解析。
  if (match - start === 0) {
    if (!silent) {
      state.pending += "$$";
    }
    state.pos = start + 1;
    return true;
  }

  // 检查有效的结束定界符
  res = isValidDelim(state, match);
  if (!res.can_close) {
    if (!silent) {
      state.pending += "$";
    }
    state.pos = start;
    return true;
  }

  if (!silent) {
    token = state.push("math_inline", "math", 0);
    token.markup = "$";
    token.content = state.src.slice(start, match);
  }

  state.pos = match + 1;
  return true;
}

function math_block(
  state: StateBlock,
  start: number,
  end: number,
  silent: boolean,
) {
  var firstLine,
    lastLine,
    next,
    lastPos,
    found = false,
    token,
    pos = state.bMarks[start] + state.tShift[start],
    max = state.eMarks[start];

  if (pos + 2 > max) {
    return false;
  }
  if (state.src.slice(pos, pos + 2) !== "$$") {
    return false;
  }

  pos += 2;
  firstLine = state.src.slice(pos, max);

  if (silent) {
    return true;
  }
  if (firstLine.trim().slice(-2) === "$$") {
    // 单行表达式
    firstLine = firstLine.trim().slice(0, -2);
    found = true;
  }

  for (next = start; !found; ) {
    next++;

    if (next >= end) {
      break;
    }

    pos = state.bMarks[next] + state.tShift[next];
    max = state.eMarks[next];

    if (pos < max && state.tShift[next] < state.blkIndent) {
      // 具有负缩进的非空行应停止列表：
      break;
    }

    if (state.src.slice(pos, max).trim().slice(-2) === "$$") {
      lastPos = state.src.slice(0, max).lastIndexOf("$$");
      lastLine = state.src.slice(pos, lastPos);
      found = true;
    }
  }

  state.line = next + 1;

  token = state.push("math_block", "math", 0);
  token.block = true;
  token.content =
    (firstLine && firstLine.trim() ? firstLine + "\n" : "") +
    state.getLines(start + 1, next, state.tShift[start], true) +
    (lastLine && lastLine.trim() ? lastLine : "");
  token.map = [start, state.line];
  token.markup = "$$";
  return true;
}

export default (md: MarkdownIt, options: any) => {
  // 默认选项

  options = options || {};
  const renderer: MathRenderer =
    options.renderer === "katex" ? "katex" : "auto";

  // 设置 KaTeX 为 markdown-it-simplemath 的渲染器
  var katexInline = function (latex: string) {
    options.displayMode = false;
    const mathJaxContent = renderMathJax(latex, false, renderer);
    if (mathJaxContent) {
      return `<span class="inline-equation">${mathJaxContent}</span>`;
    }
    try {
      const rendered = katex.renderToString(latex, {
        displayMode: false,
        throwOnError: false,
      });
      return `<span class="inline-equation" data-latex="${escapeAttribute(latex)}">${rendered}</span>`;
    } catch (error) {
      if (options.throwOnError) {
        throw error;
      }
      return `<span class="inline-equation" data-latex="${escapeAttribute(latex)}">${escapeHtml(latex)}</span>`;
    }
  };

  var inlineRenderer = function (tokens: Token[], idx: number) {
    return katexInline(tokens[idx].content);
  };

  var katexBlock = function (latex: string) {
    options.displayMode = true;
    const mathJaxContent = renderMathJax(latex, true, renderer);
    if (mathJaxContent) {
      return `<section class="block-equation">${mathJaxContent}</section>`;
    }
    try {
      const rendered = katex.renderToString(latex, {
        displayMode: true,
        throwOnError: false,
      });
      return `<section class="block-equation" data-latex="${escapeAttribute(latex)}">${rendered}</section>`;
    } catch (error) {
      if (options.throwOnError) {
        throw error;
      }
      return `<section class="block-equation" data-latex="${escapeAttribute(latex)}">${escapeHtml(latex)}</section>`;
    }
  };

  var blockRenderer = function (tokens: Token[], idx: number) {
    return katexBlock(tokens[idx].content) + "\n";
  };

  md.inline.ruler.after("escape", "math_inline", math_inline);
  md.block.ruler.after("blockquote", "math_block", math_block, {
    alt: ["paragraph", "reference", "blockquote", "list"],
  });
  md.renderer.rules.math_inline = inlineRenderer;
  md.renderer.rules.math_block = blockRenderer;
};

declare global {
  interface Window {
    MathJax?: {
      tex2svg?: (math: string, options: { display: boolean }) => HTMLElement;
      texReset?: () => void;
      startup?: {
        defaultReady: () => void;
        ready?: () => void;
      };
      typesetClear?: (elements: Element[]) => void;
      typesetPromise?: (elements: Element[]) => Promise<void>;
    };
  }
}
