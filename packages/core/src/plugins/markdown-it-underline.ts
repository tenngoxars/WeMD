import MarkdownIt from "markdown-it";
import StateInline from "markdown-it/lib/rules_inline/state_inline";

const MARKER = "+".charCodeAt(0);

function isWhitespace(char: string | undefined) {
  return !char || /\s/.test(char);
}

function underlineInline(state: StateInline, silent: boolean): boolean {
  const start = state.pos;

  if (state.src.charCodeAt(start) !== MARKER) return false;
  if (start + 1 >= state.posMax) return false;
  if (state.src.charCodeAt(start + 1) !== MARKER) return false;
  // Reject +++ to keep syntax consistent with editor rules
  if (start + 2 < state.posMax && state.src.charCodeAt(start + 2) === MARKER) {
    return false;
  }

  // Ignore escaped delimiters
  if (start > 0 && state.src.charCodeAt(start - 1) === 0x5c) return false;

  const nextChar = state.src.charAt(start + 2);
  if (isWhitespace(nextChar)) return false;
  if (silent) return false;

  const max = state.posMax;
  let pos = start + 2;

  while (pos + 1 < max) {
    if (
      state.src.charCodeAt(pos) === MARKER &&
      state.src.charCodeAt(pos + 1) === MARKER
    ) {
      // Ignore escaped delimiters
      if (pos > 0 && state.src.charCodeAt(pos - 1) === 0x5c) {
        pos++;
        continue;
      }

      const prevChar = state.src.charAt(pos - 1);
      if (isWhitespace(prevChar)) {
        pos++;
        continue;
      }

      const content = state.src.slice(start + 2, pos);
      if (!content) return false;

      state.pos = pos + 2;

      const open = state.push("underline_open", "u", 1);
      open.markup = "++";

      const innerTokens: StateInline["tokens"] = [];
      state.md.inline.parse(content, state.md, state.env, innerTokens);
      state.tokens.push(...innerTokens);

      const close = state.push("underline_close", "u", -1);
      close.markup = "++";

      return true;
    }
    pos++;
  }

  return false;
}

export default (md: MarkdownIt) => {
  md.inline.ruler.before("emphasis", "underline", underlineInline);
};
