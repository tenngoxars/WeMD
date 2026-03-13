import type { DesignerVariables } from "../types";

const toAlphaColor = (color: string, alpha: number): string => {
  const trimmed = color.trim();
  if (!trimmed) return color;

  if (trimmed.startsWith("#")) {
    const hex = trimmed.slice(1);
    const normalize = (value: string) =>
      value.length === 1 ? value + value : value;
    if (hex.length === 3 || hex.length === 4) {
      const r = parseInt(normalize(hex[0]), 16);
      const g = parseInt(normalize(hex[1]), 16);
      const b = parseInt(normalize(hex[2]), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }

  const rgbMatch =
    trimmed.match(/^rgb\s*\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,]+)\s*\)$/i) ||
    trimmed.match(
      /^rgba\s*\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,]+)\s*,\s*[^)]+\)$/i,
    );
  if (rgbMatch) {
    const [, r, g, b] = rgbMatch;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  const hslMatch =
    trimmed.match(/^hsl\s*\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,]+)\s*\)$/i) ||
    trimmed.match(
      /^hsla\s*\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,]+)\s*,\s*[^)]+\)$/i,
    );
  if (hslMatch) {
    const [, h, s, l] = hslMatch;
    return `hsla(${h}, ${s}, ${l}, ${alpha})`;
  }

  return color;
};

export function generateVariables(
  v: DesignerVariables,
  safeFontFamily: string,
): string {
  const primaryColor20 = toAlphaColor(v.primaryColor, 0.12);
  const primaryColor30 = toAlphaColor(v.primaryColor, 0.18);
  const primaryColor50 = toAlphaColor(v.primaryColor, 0.5);
  const underlineStyle = v.underlineStyle || "solid";
  const underlineColor = v.underlineColor || "currentColor";
  return `#wemd {
  /* CSS 变量 - 可在 CSS 编辑模式下覆盖 */
  /* 全局 */
  --wemd-page-padding: ${v.pagePadding ?? 8}px;
  --wemd-font-size: ${v.fontSize};
  --wemd-line-height: ${v.lineHeight};
  --wemd-paragraph-margin: ${v.paragraphMargin}px;
  --wemd-paragraph-padding: ${v.paragraphPadding ?? 0}px;
  --wemd-text-color: ${v.paragraphColor};
  --wemd-primary-color: ${v.primaryColor};
  --wemd-primary-color-20: ${primaryColor20};
  --wemd-primary-color-30: ${primaryColor30};
  --wemd-primary-color-50: ${primaryColor50};
  --wemd-letter-spacing: ${v.baseLetterSpacing || 0}px;
  --wemd-underline-style: ${underlineStyle};
  --wemd-underline-color: ${underlineColor};
  
  /* 标题 */
  --wemd-h1-font-size: ${v.h1.fontSize}px;
  --wemd-h1-color: ${v.h1.color};
  --wemd-h1-margin-top: ${v.h1.marginTop}px;
  --wemd-h1-margin-bottom: ${v.h1.marginBottom}px;
  --wemd-h2-font-size: ${v.h2.fontSize}px;
  --wemd-h2-color: ${v.h2.color};
  --wemd-h2-margin-top: ${v.h2.marginTop}px;
  --wemd-h2-margin-bottom: ${v.h2.marginBottom}px;
  --wemd-h3-font-size: ${v.h3.fontSize}px;
  --wemd-h3-color: ${v.h3.color};
  --wemd-h3-margin-top: ${v.h3.marginTop}px;
  --wemd-h3-margin-bottom: ${v.h3.marginBottom}px;
  --wemd-h4-font-size: ${v.h4.fontSize}px;
  --wemd-h4-color: ${v.h4.color};
  --wemd-h4-margin-top: ${v.h4.marginTop}px;
  --wemd-h4-margin-bottom: ${v.h4.marginBottom}px;
  
  /* 代码 */
  --wemd-code-background: ${v.codeBackground};
  --wemd-code-font-size: ${v.codeFontSize}px;
  --wemd-inline-code-color: ${v.inlineCodeColor};
  --wemd-inline-code-background: ${v.inlineCodeBackground};
  
  /* 引用 */
  --wemd-quote-background: ${v.quoteBackground};
  --wemd-quote-border-color: ${v.quoteBorderColor};
  --wemd-quote-border-width: ${v.quoteBorderWidth}px;
  --wemd-quote-border-style: ${v.quoteBorderStyle};
  --wemd-quote-text-color: ${v.quoteTextColor};
  --wemd-quote-font-size: ${v.quoteFontSize}px;
  --wemd-quote-line-height: ${v.quoteLineHeight};
  --wemd-quote-padding-x: ${v.quotePaddingX}px;
  --wemd-quote-padding-y: ${v.quotePaddingY}px;
  
  /* 图片 */
  --wemd-image-margin: ${v.imageMargin}px;
  --wemd-image-border-radius: ${v.imageBorderRadius}px;
  --wemd-image-shadow: ${v.imageShadow ? "0 4px 12px rgba(0, 0, 0, 0.12)" : "none"};
  --wemd-image-caption-color: ${v.imageCaptionColor};
  --wemd-image-caption-font-size: ${v.imageCaptionFontSize}px;
  --wemd-image-caption-align: ${v.imageCaptionTextAlign};
  
  /* 链接与文本 */
  --wemd-link-color: ${v.linkColor || v.primaryColor};
  --wemd-italic-color: ${v.italicColor};
  --wemd-del-color: ${v.delColor};
  --wemd-mark-background: ${v.markBackground};
  --wemd-mark-color: ${v.markColor};
  
  /* 表格 */
  --wemd-table-header-background: ${v.tableHeaderBackground};
  --wemd-table-header-color: ${v.tableHeaderColor};
  --wemd-table-border-color: ${v.tableBorderColor};
  
  /* 分割线 */
  --wemd-hr-color: ${v.hrColor};
  --wemd-hr-height: ${v.hrHeight}px;
  --wemd-hr-margin: ${v.hrMargin}px;
  
  /* 列表 */
  --wemd-list-spacing: ${v.listSpacing}px;
  --wemd-list-marker-color: ${v.listMarkerColor};
  --wemd-list-marker-color-l2: ${v.listMarkerColorL2};

  font-family: ${safeFontFamily};
  padding: 0 var(--wemd-page-padding);
  color: var(--wemd-text-color);
  overflow-wrap: break-word;
}`;
}
