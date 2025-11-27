import juice from "juice";

// 常量定义
const DATA_TOOL = "WeMD编辑器";
const SECTION_ID = "wemd";

// 需要添加 data-tool 属性的块级元素
const BLOCK_TAGS = [
    'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'blockquote',
    'table', 'figure', 'pre', 'hr'
] as const;

/**
 * 处理 HTML，添加 data-tool 属性并应用 CSS 样式
 * @param html - 原始 HTML 字符串
 * @param css - CSS 样式字符串
 * @returns 处理后的 HTML 字符串
 */
export const processHtml = (html: string, css: string): string => {
    if (!html || !css) {
        return html || '';
    }

    // Add data-tool attribute to top-level block elements
    BLOCK_TAGS.forEach(tag => {
        const regex = new RegExp(`<${tag}(\\s+[^>]*|)>`, 'gi');
        html = html.replace(regex, (match, attributes) => {
            // Check if data-tool already exists to avoid duplication
            if (match.includes('data-tool=')) return match;
            // attributes includes the leading space if present, or is empty string
            return `<${tag} data-tool="${DATA_TOOL}"${attributes}>`;
        });
    });

    // 处理 MathJax 相关的替换
    html = html.replace(/<mjx-container (class="inline.+?)<\/mjx-container>/g, "<span $1</span>");
    html = html.replace(/\s<span class="inline/g, '&nbsp;<span class="inline');
    html = html.replace(/svg><\/span>\s/g, "svg></span>&nbsp;");
    html = html.replace(/mjx-container/g, "section");
    html = html.replace(/class="mjx-solid"/g, 'fill="none" stroke-width="70"');
    html = html.replace(/<mjx-assistive-mml.+?<\/mjx-assistive-mml>/g, "");

    // Wrap html in a section with id="wemd" so that juice can match selectors starting with #wemd
    const wrappedHtml = `<section id="${SECTION_ID}">${html}</section>`;

    try {
        const res = juice.inlineContent(wrappedHtml, css, {
            inlinePseudoElements: true,
            preserveImportant: true,
        });

        // Keep the section#wemd wrapper to preserve #wemd styles (padding, max-width, border, etc.)
        // This matches the legacy behavior where #wemd styles are applied to the container
        return res;
    } catch (e) {
        console.error("Juice inline error:", e);
        // 返回包装后的 HTML，即使 juice 处理失败
        return wrappedHtml;
    }
};
