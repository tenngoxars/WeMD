import juice from "juice";

const DATA_TOOL = "WeMD编辑器";
const SECTION_ID = "wemd";

const BLOCK_TAGS = [
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "blockquote",
  "table",
  "figure",
  "pre",
  "hr",
] as const;

/**
 * 处理 HTML，添加 data-tool 属性并应用 CSS 样式
 * @param html - 原始 HTML 字符串
 * @param css - CSS 样式字符串
 * @param inlineStyles - 是否内联样式 (使用 juice)，默认为 true。预览模式建议设为 false 以提高性能。
 * @param inlinePseudoElements - 是否内联伪元素内容（如 ::before / ::after），默认为 false。复制到微信时建议设为 true。
 * @returns 处理后的 HTML 字符串
 */
export const processHtml = (
  html: string,
  css: string,
  inlineStyles: boolean = true,
  inlinePseudoElements: boolean = false,
): string => {
  if (!html || !css) {
    return html || "";
  }

  // 为顶级块元素添加 data-tool 属性
  BLOCK_TAGS.forEach((tag) => {
    const regex = new RegExp(`<${tag}(\\s+[^>]*|)>`, "gi");
    html = html.replace(regex, (match, attributes) => {
      if (match.includes("data-tool=")) return match;
      return `<${tag} data-tool="${DATA_TOOL}"${attributes}>`;
    });
  });

  // 处理 MathJax 相关的替换
  html = html.replace(
    /<mjx-container (class="inline.+?)<\/mjx-container>/g,
    "<span $1</span>",
  );
  html = html.replace(/\s<span class="inline/g, '&nbsp;<span class="inline');
  html = html.replace(/svg><\/span>\s/g, "svg></span>&nbsp;");
  html = html.replace(/mjx-container/g, "section");
  html = html.replace(/class="mjx-solid"/g, 'fill="none" stroke-width="70"');
  html = html.replace(/<mjx-assistive-mml.+?<\/mjx-assistive-mml>/g, "");

  // 保护代码块中的空格，防止微信清洗时删除
  html = html.replace(
    /<code([^>]*class="[^"]*\bhljs\b[^"]*"[^>]*)>([\s\S]*?)<\/code>/g,
    (match, attrs: string, inner: string) => {
      let protected_ = inner;
      protected_ = protected_.replace(/\t/g, "&nbsp;&nbsp;");
      protected_ = protected_.replace(/<\/span> <span/g, " </span><span");
      protected_ = protected_.replace(/\n( +)/g, (m, spaces: string) => {
        return "\n" + "&nbsp;".repeat(spaces.length);
      });
      protected_ = protected_.replace(/^( +)/, (m, spaces: string) => {
        return "&nbsp;".repeat(spaces.length);
      });
      return `<code${attrs}>${protected_}</code>`;
    },
  );

  // 检测 Mac 风格控制栏：同时检测伪元素选择器和红绿灯颜色
  const hasMacBarPseudo =
    css.includes("pre.custom::before") || css.includes("pre::before");
  const hasMacBar = hasMacBarPseudo && css.includes("#ff5f56");

  // 复制到微信时，将 CSS 伪元素替换为真实 HTML（微信会清洗伪元素）
  if (hasMacBar && inlinePseudoElements) {
    let paddingTop = 36;
    const paddingMatch = css.match(
      /pre\s+code\.hljs\s*\{[^}]*padding:\s*(\d+)px/i,
    );
    if (paddingMatch) {
      paddingTop = parseInt(paddingMatch[1], 10);
    }
    const marginTop = -(paddingTop - 12);

    const macBarHtml = `<span style="display:block;margin:${marginTop}px 0 16px 0;line-height:1;"><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#ff5f56;margin-right:8px;"></span><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#ffbd2e;margin-right:8px;"></span><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#27c93f;"></span></span>`;

    html = html.replace(
      /<code([^>]*class="[^"]*\bhljs\b[^"]*"[^>]*)>/gi,
      `<code$1>${macBarHtml}`,
    );

    css = css.replace(
      /#wemd[^{]*pre[^{]*::before\s*\{[^}]*#ff5f56[^}]*\}/gi,
      "",
    );
  }

  // 包裹在 section#wemd 中，复制时添加透明背景防止某些浏览器保留选区背景色
  const bgStyle = inlinePseudoElements
    ? ' style="background:transparent;background-color:transparent;"'
    : "";
  const wrappedHtml = `<section id="${SECTION_ID}"${bgStyle}>${html}</section>`;

  if (!inlineStyles) {
    return wrappedHtml;
  }

  try {
    let res = juice.inlineContent(wrappedHtml, css, {
      inlinePseudoElements,
      preserveImportant: true,
    });

    // 在 juice 处理之后，为代码块追加关键内联样式
    // 这确保我们的样式不会被 juice 覆盖，且优先级最高
    if (inlinePseudoElements) {
      const appendStyleValue = (styleValue: string, extra: string) => {
        const trimmed = styleValue.trim();
        if (!trimmed) return extra;
        const needsSemicolon = !trimmed.endsWith(";");
        return `${trimmed}${needsSemicolon ? ";" : ""}${extra}`;
      };

      // 处理 pre 元素：确保 overflow 和 white-space 正确
      res = res.replace(
        /<pre([^>]*)(style="[^"]*")([^>]*)>/gi,
        (match, before: string, styleAttr: string, after: string) => {
          const styleMatch = styleAttr.match(/style="([^"]*)"/i);
          const existing = styleMatch ? styleMatch[1] : "";
          const nextStyle = appendStyleValue(
            existing,
            "overflow-x:auto;-webkit-overflow-scrolling:touch;",
          );
          return `<pre${before}style="${nextStyle}"${after}>`;
        },
      );

      // 处理 code 元素：防止 text-align:justify 破坏代码格式
      // 匹配所有带 style 属性的 code 元素（不限制 class）
      res = res.replace(
        /<code([^>]*)(style="[^"]*")([^>]*)>/gi,
        (match, before: string, styleAttr: string, after: string) => {
          const styleMatch = styleAttr.match(/style="([^"]*)"/i);
          const existing = styleMatch ? styleMatch[1] : "";
          const normalized = existing.replace(
            /white-space:\s*pre-wrap/gi,
            "white-space:pre",
          );
          const nextStyle = appendStyleValue(
            normalized,
            "text-align:left;letter-spacing:0;word-spacing:0;",
          );
          return `<code${before}style="${nextStyle}"${after}>`;
        },
      );
    }

    return res;
  } catch (e) {
    console.error("Juice inline error:", e);
    return wrappedHtml;
  }
};
