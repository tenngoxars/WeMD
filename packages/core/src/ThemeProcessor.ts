import juice from "juice";

// 常量定义
const DATA_TOOL = "WeMD编辑器";
const SECTION_ID = "wemd";

// 需要添加 data-tool 属性的块级元素
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
      // 检查 data-tool 是否已存在，避免重复
      if (match.includes("data-tool=")) return match;
      // attributes 包含前导空格（如果存在），或者为空字符串
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

    // 移除 CSS 伪元素规则，避免重复
    css = css.replace(
      /#wemd[^{]*pre[^{]*::before\s*\{[^}]*#ff5f56[^}]*\}/gi,
      "",
    );
  }

  // 将 HTML 包裹在 id="wemd" 的 section 中，以便 juice 能够匹配以 #wemd 开头的选择器
  const wrappedHtml = `<section id="${SECTION_ID}">${html}</section>`;

  if (!inlineStyles) {
    return wrappedHtml;
  }

  try {
    const res = juice.inlineContent(wrappedHtml, css, {
      inlinePseudoElements,
      preserveImportant: true,
    });

    // 保留 section#wemd 包裹层以保持 #wemd 样式（边距、最大宽度、边框等）
    // 这与遗留行为一致，其中 #wemd 样式应用于容器
    return res;
  } catch (e) {
    console.error("Juice inline error:", e);
    // 返回包装后的 HTML，即使 juice 处理失败
    return wrappedHtml;
  }
};
