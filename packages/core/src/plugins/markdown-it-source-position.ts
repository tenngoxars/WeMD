import type MarkdownIt from "markdown-it";
import type StateCore from "markdown-it/lib/rules_core/state_core";
import type Token from "markdown-it/lib/token";

const SOURCE_START_ATTRIBUTE = "data-wemd-source-start";
const SOURCE_END_ATTRIBUTE = "data-wemd-source-end";
const STANDALONE_RENDERERS = ["fence", "math_block"] as const;

const hasSourceMap = (
  token: Token,
): token is Token & { map: [number, number] } =>
  token.block &&
  token.map !== null &&
  token.map.length === 2 &&
  Number.isFinite(token.map[0]) &&
  Number.isFinite(token.map[1]);

const addSourceAttributes = (token: Token): void => {
  if (!hasSourceMap(token)) return;
  if (token.nesting !== 1 && token.nesting !== 0) return;

  token.attrSet(SOURCE_START_ATTRIBUTE, String(token.map[0]));
  token.attrSet(SOURCE_END_ATTRIBUTE, String(token.map[1]));
};

const injectTokenAttributes = (html: string, token: Token): string => {
  const attributes = token.attrs
    ?.filter(
      ([name]) =>
        name === SOURCE_START_ATTRIBUTE || name === SOURCE_END_ATTRIBUTE,
    )
    .map(([name, value]) => ` ${name}="${value}"`)
    .join("");

  if (!attributes) return html;
  return html.replace(/^<([a-z][^>]*)(>)/i, `<$1${attributes}$2`);
};

export default (md: MarkdownIt): void => {
  md.core.ruler.push("wemd_source_position", (state: StateCore) => {
    state.tokens.forEach(addSourceAttributes);
  });

  STANDALONE_RENDERERS.forEach((type) => {
    const originalRenderer = md.renderer.rules[type];
    if (!originalRenderer) return;

    md.renderer.rules[type] = (tokens, index, options, env, renderer) =>
      injectTokenAttributes(
        originalRenderer(tokens, index, options, env, renderer),
        tokens[index],
      );
  });
};
