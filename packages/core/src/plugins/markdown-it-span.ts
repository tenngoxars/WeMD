import type MarkdownIt from "markdown-it";
import type StateCore from "markdown-it/lib/rules_core/state_core";

function slugify(s: string, md: MarkdownIt) {
  // Unicode-friendly
  // @ts-expect-error - accessing internal md.utils.lib.ucmicro property
  const spaceRegex = new RegExp(md.utils.lib.ucmicro.Z.source, "g");
  return encodeURIComponent(s.replace(spaceRegex, ""));
}

function makeRule(md: MarkdownIt, options: any) {
  return function addHeadingAnchors(state: StateCore) {
    // Go to length-2 because we're going to be peeking ahead.
    for (let i = 0; i < state.tokens.length - 1; i++) {
      if (
        state.tokens[i].type !== "heading_open" ||
        state.tokens[i + 1].type !== "inline"
      ) {
        continue;
      }

      const headingInlineToken = state.tokens[i + 1];

      if (!headingInlineToken.content || !headingInlineToken.children) {
        continue;
      }

      if (options.addHeadingSpan) {
        const spanTokenPre = new state.Token("html_inline", "", 0);
        spanTokenPre.content = `<span class="prefix"></span><span class="content">`;
        headingInlineToken.children.unshift(spanTokenPre);
        const spanTokenPost = new state.Token("html_inline", "", 0);
        spanTokenPost.content = `</span><span class="suffix"></span>`;
        headingInlineToken.children.push(spanTokenPost);
      }

      // Advance past the inline and heading_close tokens.
      i += 2;
    }
  };
}

export default (md: MarkdownIt, opts: any) => {
  const defaults = {
    anchorClass: "markdown-it-headingspan",
    addHeadingSpan: true,
    slugify: slugify,
  };
  const options = md.utils.assign(defaults, opts);
  md.core.ruler.push("heading_span", makeRule(md, options));
};
