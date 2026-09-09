import type MarkdownIt from "markdown-it";
import type Token from "markdown-it/lib/token";
import type Renderer from "markdown-it/lib/renderer";
import type StateInline from "markdown-it/lib/rules_inline/state_inline";
import type StateCore from "markdown-it/lib/rules_core/state_core";

function renderFootnoteAnchorName(
  tokens: Token[],
  idx: number,
  options: any,
  env: any,
) {
  const n = Number(tokens[idx].meta.id + 1).toString();
  let prefix = "";

  if (typeof env.docId === "string") {
    prefix = "-" + env.docId + "-";
  }

  return prefix + n;
}

function renderFootnoteCaption(tokens: Token[], idx: number) {
  let n = Number(tokens[idx].meta.id + 1).toString();

  if (tokens[idx].meta.subId > 0) {
    n += ":" + tokens[idx].meta.subId;
  }

  return "[" + n + "]";
}

function renderFootnoteWord(
  tokens: Token[],
  idx: number,
  options: any,
  env: any,
  slf: Renderer,
) {
  return '<span class="footnote-word">' + tokens[idx].content + "</span>";
}

function renderFootnoteRef(
  tokens: Token[],
  idx: number,
  options: any,
  env: any,
  slf: Renderer,
) {
  const caption = slf.rules.footnote_caption!(tokens, idx, options, env, slf);
  return '<sup class="footnote-ref">' + caption + "</sup>";
}

// eslint-disable-next-line
function renderFootnoteBlockOpen(tokens: Token[], idx: number, options: any) {
  return '<h3 class="footnotes-sep"></h3>\n<section class="footnotes">\n';
}

function renderFootnoteBlockClose() {
  return "</section>\n";
}

function renderFootnoteOpen(
  tokens: Token[],
  idx: number,
  options: any,
  env: any,
  slf: Renderer,
) {
  let id = slf.rules.footnote_anchor_name!(tokens, idx, options, env, slf);

  if (tokens[idx].meta.subId > 0) {
    id += ":" + tokens[idx].meta.subId;
  }

  return (
    '<span id="fn' +
    id +
    '" class="footnote-item"><span class="footnote-num">[' +
    id +
    "] </span>"
  );
}

function renderFootnoteClose() {
  return "</span>\n";
}

// 处理 [link](<to> "stuff")
function isSpace(code: number) {
  switch (code) {
    case 0x09:
    case 0x20:
      return true;
    default:
  }
  return false;
}

function normalizeReference(str: string) {
  // 使用 .toUpperCase() 替代 .toLowerCase()
  // 以避免与 Object.prototype 成员冲突
  // (最显着的是 `__proto__`)
  return str.trim().replace(/\s+/g, " ").toUpperCase();
}

function linkFoot(state: StateInline, silent: boolean) {
  let attrs: [string, string][],
    code,
    label,
    pos,
    res,
    ref,
    title,
    token,
    href = "",
    start = state.pos,
    footnoteContent,
    parseReference = true;
  const oldPos = state.pos;
  const max = state.posMax;

  if (state.src.charCodeAt(state.pos) !== 0x5b /* [ */) {
    return false;
  }

  const labelStart = state.pos + 1;
  const labelEnd = state.md.helpers.parseLinkLabel(state, state.pos, true);

  // 解析器未找到 ']'，因此不是有效链接
  if (labelEnd < 0) {
    return false;
  }

  pos = labelEnd + 1;
  if (pos < max && state.src.charCodeAt(pos) === 0x28 /* ( */) {
    //
    // 内联链接
    //

    // 可能找到了有效的快捷链接，禁用引用解析
    parseReference = false;

    // [link](  <href>  "title"  )
    //        ^^ 跳过这些空格
    pos++;
    for (; pos < max; pos++) {
      code = state.src.charCodeAt(pos);
      if (!isSpace(code) && code !== 0x0a) {
        break;
      }
    }
    if (pos >= max) {
      return false;
    }

    // [link](  <href>  "title"  )
    //          ^^^^^^ 解析链接目标
    start = pos;
    res = state.md.helpers.parseLinkDestination(state.src, pos, state.posMax);
    if (res.ok) {
      href = state.md.normalizeLink(res.str);
      footnoteContent = res.str;
      if (state.md.validateLink(href)) {
        pos = res.pos;
      } else {
        href = "";
      }
    }

    // [link](  <href>  "title"  )
    //                ^^ 跳过这些空格
    start = pos;
    for (; pos < max; pos++) {
      code = state.src.charCodeAt(pos);
      if (!isSpace(code) && code !== 0x0a) {
        break;
      }
    }

    // [link](  <href>  "title"  )
    //                  ^^^^^^^ 解析链接标题
    res = state.md.helpers.parseLinkTitle(state.src, pos, state.posMax);
    if (pos < max && start !== pos && res.ok) {
      title = res.str;
      pos = res.pos;

      // [link](  <href>  "title"  )
      //                         ^^ 跳过这些空格
      for (; pos < max; pos++) {
        code = state.src.charCodeAt(pos);
        if (!isSpace(code) && code !== 0x0a) {
          break;
        }
      }
    } else {
      title = "";
    }

    if (pos >= max || state.src.charCodeAt(pos) !== 0x29 /* ) */) {
      // 解析快捷链接失败，回退到引用解析
      parseReference = true;
    }
    pos++;
  }

  if (parseReference) {
    //
    // 链接引用
    //
    if (typeof state.env.references === "undefined") {
      return false;
    }

    if (pos < max && state.src.charCodeAt(pos) === 0x5b /* [ */) {
      start = pos + 1;
      pos = state.md.helpers.parseLinkLabel(state, pos);
      if (pos >= 0) {
        label = state.src.slice(start, pos++);
      } else {
        pos = labelEnd + 1;
      }
    } else {
      pos = labelEnd + 1;
    }

    // 覆盖 label === '' 和 label === undefined 的情况
    // (分别是折叠引用链接和快捷引用链接)
    if (!label) {
      label = state.src.slice(labelStart, labelEnd);
    }

    ref = state.env.references[normalizeReference(label)];
    if (!ref) {
      state.pos = oldPos;
      return false;
    }
    href = ref.href;
    title = ref.title;
  }

  //
  // 我们找到了链接的结尾，并且确信它是一个有效的链接；
  // 所以剩下的就是调用 tokenizer。
  //
  if (!silent) {
    // 如果存在标题则转成脚注
    if (title) {
      state.pos = labelStart;
      state.posMax = labelEnd;

      let tokens: Token[];

      if (!state.env.footnotes) {
        state.env.footnotes = {};
      }
      if (!state.env.footnotes.list) {
        state.env.footnotes.list = [];
      }

      const footnoteId = state.env.footnotes.list.length;

      // *用来让链接倾斜
      state.md.inline.parse(
        `${title}: *${footnoteContent}*`,
        state.md,
        state.env,
        (tokens = []),
      );

      token = state.push("footnote_word", "", 0);
      token.content = state.src.slice(labelStart, labelEnd);

      token = state.push("footnote_ref", "", 0);
      token.meta = { id: footnoteId };

      state.env.footnotes.list[footnoteId] = { tokens: tokens };
    }
    // 不存在标题则判断域名
    else {
      state.pos = labelStart;
      state.posMax = labelEnd;

      token = state.push("link_open", "a", 1);
      attrs = [["href", href]];
      token.attrs = attrs;
      if (title) {
        attrs.push(["title", title]);
      }

      state.md.inline.tokenize(state);

      token = state.push("link_close", "a", -1);
    }
  }

  state.pos = pos;
  state.posMax = max;

  return true;
}

// 将脚注 tokens 粘合到 token 流的末尾
function footnoteTail(state: StateCore) {
  let i: number,
    l: number,
    lastParagraph: Token | null | undefined,
    token: Token,
    tokens: Token[] | undefined,
    current: Token[] = [],
    currentLabel = "",
    insideRef = false;
  const refTokens: Record<string, Token[]> = {};

  if (!state.env.footnotes) {
    return;
  }

  state.tokens = state.tokens.filter((tok) => {
    if (tok.type === "footnote_reference_open") {
      insideRef = true;
      current = [];
      currentLabel = tok.meta.label;
      return false;
    }
    if (tok.type === "footnote_reference_close") {
      insideRef = false;
      // 前置 ':' 以避免与 Object.prototype 成员冲突
      refTokens[":" + currentLabel] = current;
      return false;
    }
    if (insideRef) {
      current.push(tok);
    }
    return !insideRef;
  });

  if (!state.env.footnotes.list) {
    return;
  }
  const list = state.env.footnotes.list;

  token = new state.Token("footnote_block_open", "", 1);
  state.tokens.push(token);

  for (i = 0, l = list.length; i < l; i++) {
    token = new state.Token("footnote_open", "", 1);
    token.meta = { id: i, label: list[i].label };
    state.tokens.push(token);

    if (list[i].tokens) {
      tokens = [];

      token = new state.Token("paragraph_open", "p", 1);
      token.block = true;
      tokens.push(token);

      token = new state.Token("inline", "", 0);
      token.children = list[i].tokens;
      token.content = "";
      tokens.push(token);

      token = new state.Token("paragraph_close", "p", -1);
      token.block = true;
      tokens.push(token);
    } else if (list[i].label) {
      tokens = refTokens[":" + list[i].label];
    }

    if (tokens) {
      state.tokens = state.tokens.concat(tokens);
    }
    if (state.tokens[state.tokens.length - 1].type === "paragraph_close") {
      lastParagraph = state.tokens.pop();
    } else {
      lastParagraph = null;
    }

    if (lastParagraph) {
      state.tokens.push(lastParagraph);
    }

    token = new state.Token("footnote_close", "", -1);
    state.tokens.push(token);
  }

  token = new state.Token("footnote_block_close", "", -1);
  state.tokens.push(token);
}

export default (md: MarkdownIt) => {
  md.renderer.rules.footnote_ref = renderFootnoteRef;
  md.renderer.rules.footnote_word = renderFootnoteWord;
  md.renderer.rules.footnote_block_open = renderFootnoteBlockOpen;
  md.renderer.rules.footnote_block_close = renderFootnoteBlockClose;
  md.renderer.rules.footnote_open = renderFootnoteOpen;
  md.renderer.rules.footnote_close = renderFootnoteClose;

  // 辅助函数 (仅用于其他规则，不附加 token)
  md.renderer.rules.footnote_caption = renderFootnoteCaption;
  md.renderer.rules.footnote_anchor_name = renderFootnoteAnchorName;

  md.inline.ruler.at("link", linkFoot);
  md.core.ruler.after("inline", "footnote_tail", footnoteTail);
};
