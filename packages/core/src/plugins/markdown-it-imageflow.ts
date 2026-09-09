import type MarkdownIt from "markdown-it";
import type StateBlock from "markdown-it/lib/rules_block/state_block";
import type Token from "markdown-it/lib/token";

const defaultOption = {
  limitless: false, // 限制图片数量
  limit: 10, // 图片数量上限
};

const imageFlowPlugin = (md: MarkdownIt, opt: any) => {
  const options = opt || defaultOption;

  const tokenize = (state: StateBlock, start: number) => {
    let token;

    const matchReg = /^<((!\[[^[\]]*\]\([^()]+\)(,?\s*(?=>)|,\s*(?!>)))+)>/;
    const srcLine = state.src.slice(state.bMarks[start], state.eMarks[start]);

    if (srcLine.charCodeAt(0) !== 0x3c /* < */) {
      return false;
    }
    const match = matchReg.exec(srcLine);

    if (match) {
      const images = match[1].match(/\[[^\]]*\]\([^)]+\)/g);
      if (images && !options.limitless && images.length <= options.limit) {
        token = state.push("imageFlow", "", 0);
        token.meta = images;
        token.block = true;

        // update line
        state.line++;
        return true;
      }
    }
    return false;
  };

  md.renderer.rules.imageFlow = (tokens: Token[], idx: number) => {
    const start = `<section class="imageflow-layer1"><section class="imageflow-layer2">`;
    const end = `</section></section><p class="imageflow-caption"><<< 左右滑动见更多 >>></p>`;
    const contents = tokens[idx].meta as string[];
    let wrappedContent = "";
    let alt;
    let src;
    contents.forEach((content) => {
      const altMatch = content.match(/\[([^[\]]*)\]/);
      alt = altMatch ? altMatch[1] : "";
      const srcMatch = content.match(/[^[]*\(([^()]*)\)[^\]]*/);
      src = srcMatch ? srcMatch[1] : "";
      wrappedContent += `<section class="imageflow-layer3"><img alt="${alt}" src="${src}" class="imageflow-img" /></section>`;
    });

    return start + wrappedContent + end;
  };

  md.block.ruler.before("paragraph", "imageFlow", tokenize);
};

export default imageFlowPlugin;
