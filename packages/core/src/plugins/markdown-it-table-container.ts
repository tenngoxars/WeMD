import type MarkdownIt from "markdown-it";
import type StateCore from "markdown-it/lib/rules_core/state_core";
import type Token from "markdown-it/lib/token";

function makeRule() {
  return function addTableContainer(state: StateCore) {
    const arr: Token[] = [];
    for (let i = 0; i < state.tokens.length; i++) {
      const curToken = state.tokens[i];
      if (curToken.type === "table_open") {
        const tableContainerStart = new state.Token("html_inline", "", 0);
        tableContainerStart.content = `<section class="table-container">`;
        arr.push(tableContainerStart);
        arr.push(curToken);
      } else if (curToken.type === "table_close") {
        const tableContainerClose = new state.Token("html_inline", "", 0);
        tableContainerClose.content = `</section>`;
        arr.push(curToken);
        arr.push(tableContainerClose);
      } else {
        arr.push(curToken);
      }
    }
    state.tokens = arr;
  };
}

export default (md: MarkdownIt) => {
  md.core.ruler.push("table-container", makeRule());
};
