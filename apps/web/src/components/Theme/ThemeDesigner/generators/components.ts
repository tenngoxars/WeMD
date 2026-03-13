import type { DesignerVariables } from "../types";
import { getCodeThemeCSS } from "./codeTheme";

interface ComponentPresets {
  quotePreset: { base: string; extra: string };
}

export function generateComponents(
  v: DesignerVariables,
  presets: ComponentPresets,
): string {
  const { quotePreset } = presets;
  const underlineStyle = "var(--wemd-underline-style)";
  const underlineColor = "var(--wemd-underline-color)";
  const hrColor = "var(--wemd-hr-color)";
  const hrHeight = "var(--wemd-hr-height)";

  return `#wemd blockquote, 
#wemd .multiquote-1, 
#wemd .multiquote-2, 
#wemd .multiquote-3 {
  margin: var(--wemd-paragraph-margin) 0 !important;
  padding: var(--wemd-quote-padding-y) var(--wemd-quote-padding-x);
  ${quotePreset.base}
}
#wemd blockquote p,
#wemd .multiquote-1 p,
#wemd .multiquote-2 p,
#wemd .multiquote-3 p { 
  color: var(--wemd-quote-text-color); 
  margin: 0 !important;
  font-size: var(--wemd-quote-font-size);
  line-height: var(--wemd-quote-line-height);
  ${v.quoteTextCentered ? "text-align: center !important;" : ""}
}

#wemd pre {
  margin: var(--wemd-paragraph-margin) 0;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

#wemd pre code {
  display: block;
  background: var(--wemd-code-background);
  font-size: var(--wemd-code-font-size);
  padding: ${v.showMacBar ? "36px 16px 16px" : "16px"};
  position: relative;
  white-space: pre;
  border-radius: 8px;
  word-wrap: normal;
  word-break: keep-all;
  text-align: left;
  letter-spacing: 0;
  word-spacing: 0;
  min-width: max-content;
}

#wemd pre.custom {
  position: relative;
  margin: var(--wemd-paragraph-margin) 0;
}

${
  v.showMacBar
    ? `
#wemd pre.custom::before {
  content: "";
  position: absolute;
  top: 10px;
  left: 12px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #ff5f56;
  box-shadow: 20px 0 0 #ffbd2e, 40px 0 0 #27c93f;
  z-index: 10;
}`
    : ""
}

${getCodeThemeCSS(v.codeTheme)}

#wemd code {
  color: var(--wemd-inline-code-color);
  background: var(--wemd-inline-code-background);
  padding: 2px 4px;
  border-radius: ${v.inlineCodeStyle === "rounded" ? "12px" : v.inlineCodeStyle === "github" ? "4px" : "2px"};
  font-size: 0.9em;
  font-family: Menlo, Monaco, Consolas, "Courier New", monospace;
  white-space: normal;
  letter-spacing: 0;
  ${v.inlineCodeStyle === "github" ? "border: 1px solid rgba(0,0,0,0.06);" : ""}
  ${v.inlineCodeStyle === "color-text" ? `background: transparent; font-weight: bold; border-bottom: 2px solid var(--wemd-primary-color-50);` : ""}
}

/* 代码块样式需要更高优先级覆盖行内代码样式 */
#wemd pre code,
#wemd pre code.hljs {
  white-space: pre;
  text-align: left;
  letter-spacing: 0;
  word-spacing: 0;
}

#wemd a {
  color: var(--wemd-link-color);
  text-decoration: none;
  border-bottom: ${v.linkUnderline ? `1px solid var(--wemd-link-color)` : "none"};
  word-break: break-all;
}

#wemd em {
  font-style: italic;
  color: var(--wemd-italic-color);
}

#wemd del {
  text-decoration: line-through;
  color: var(--wemd-del-color);
}

#wemd u {
  text-decoration-line: underline;
  text-decoration-style: ${underlineStyle};
  text-underline-offset: 0.18em;
  text-decoration-thickness: 1px;
  text-decoration-color: ${underlineColor};
}

#wemd mark {
  background: var(--wemd-mark-background);
  color: var(--wemd-mark-color);
  padding: 0 2px;
  border-radius: 2px;
}

#wemd hr {
  margin: var(--wemd-hr-margin) 0;
  border: 0;
  ${(() => {
    const style = v.hrStyle || "solid";
    const color = hrColor;
    const height = hrHeight;

    if (style === "pill") {
      return `
    height: ${height};
    background: ${color};
    width: 20%;
    margin-left: auto;
    margin-right: auto;
    border-radius: 8px;
      `;
    }

    return `
    border-top: ${height} ${style} ${color};
    `;
  })()}
}
#wemd table {
  width: 100%;
  border-collapse: collapse;
  margin: var(--wemd-paragraph-margin) 0;
}

#wemd th {
  background: var(--wemd-table-header-background);
  color: var(--wemd-table-header-color);
  font-weight: bold;
}

#wemd th, #wemd td {
  border: 1px solid var(--wemd-table-border-color);
  padding: 8px 12px;
  text-align: left;
}

${
  v.tableZebra
    ? `
#wemd tr:nth-child(even) {
  background: #fcfcfc;
}`
    : ""
}

#wemd img {
  display: block;
  max-width: 100%;
  height: auto;
  margin: var(--wemd-image-margin) auto;
  border-radius: var(--wemd-image-border-radius);
  box-shadow: var(--wemd-image-shadow);
}`;
}
