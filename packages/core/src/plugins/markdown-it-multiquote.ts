import type MarkdownIt from "markdown-it";
import type StateCore from "markdown-it/lib/rules_core/state_core";
import type Token from "markdown-it/lib/token";

function makeRule() {
  return function addTableContainer(state: StateCore) {
    let count = 0;
    let outerQuoteToekn: Token | undefined;
    for (let i = 0; i < state.tokens.length; i++) {
      const curToken = state.tokens[i];
      if (curToken.type === "blockquote_open") {
        if (count === 0) {
          // 最外层 blockquote 的 token
          outerQuoteToekn = curToken;
        }
        count++;
        continue;
      }
      if (count > 0 && outerQuoteToekn) {
        outerQuoteToekn.attrs = [["class", "multiquote-" + count]];
        count = 0;
      }
    }
  };
}

export default (md: MarkdownIt) => {
  md.core.ruler.push("blockquote-class", makeRule());
};
