// 可视化主题设计器 - 默认值
import type { DesignerVariables } from "./types";
import {
  fontFamilyOptions,
  fontSizeOptions,
  primaryColorOptions,
  lineHeightOptions,
  headingSizePresets,
} from "../../../config/styleOptions";

/**
 * 设计器变量默认值
 */
export const defaultVariables: DesignerVariables = {
  // 全局
  fontFamily: fontFamilyOptions[0].value,
  fontSize: fontSizeOptions[2].value,
  primaryColor: primaryColorOptions[0].value,
  lineHeight: lineHeightOptions[2].value,
  pagePadding: 8,
  baseLetterSpacing: 0,

  // 标题
  h1: {
    fontSize: headingSizePresets.h1.default,
    color: "#000",
    marginTop: 40,
    marginBottom: 30,
    centered: false,
    fontWeight: "bold",
    letterSpacing: 0,
  },
  h2: {
    fontSize: headingSizePresets.h2.default,
    color: "#333",
    marginTop: 30,
    marginBottom: 20,
    centered: false,
    fontWeight: "bold",
    letterSpacing: 0,
  },
  h3: {
    fontSize: headingSizePresets.h3.default,
    color: "#666",
    marginTop: 25,
    marginBottom: 15,
    centered: false,
    fontWeight: "bold",
    letterSpacing: 0,
  },
  h4: {
    fontSize: headingSizePresets.h4.default,
    color: "#666",
    marginTop: 20,
    marginBottom: 10,
    centered: false,
    fontWeight: "bold",
    letterSpacing: 0,
  },

  // 段落
  paragraphMargin: 16,
  paragraphPadding: 0,
  paragraphColor: "#333",
  textIndent: false,
  textJustify: true,

  // 引用
  quoteBackground: "#f5f5f5",
  quoteBorderColor: "#ddd",
  quoteTextColor: "#666",
  quotePreset: "left-border",
  quoteBorderStyle: "solid",
  quoteBorderWidth: 4,
  quotePaddingX: 16,
  quotePaddingY: 12,
  quoteFontSize: 16,
  quoteLineHeight: 1.6,
  quoteTextCentered: false,

  // 代码
  codeBackground: "#f5f5f5",
  codeFontSize: 13,
  inlineCodeColor: "#c7254e",
  inlineCodeBackground: "#f9f2f4",
  inlineCodeStyle: "simple",
  showMacBar: true,
  codeTheme: "github",

  // 图片
  imageMargin: 20,
  imageBorderRadius: 4,
  imageCaptionColor: "#999",
  imageCaptionFontSize: 14,
  imageCaptionTextAlign: "center",

  // 链接/文本
  linkColor: "",
  linkUnderline: true,
  italicColor: "inherit",
  delColor: "#999",
  markBackground: "#fff5b1",
  markColor: "inherit",
  strongStyle: "color",
  strongColor: "inherit",

  // 表格
  tableHeaderBackground: "#f8f8f8",
  tableHeaderColor: "inherit",
  tableBorderColor: "#dfe2e5",
  tableZebra: true,

  // 分割线
  hrColor: "#eee",
  hrHeight: 1,
  hrMargin: 20,
  hrStyle: "solid",

  // 列表
  ulStyle: "disc",
  ulStyleL2: "circle",
  olStyle: "decimal",
  olStyleL2: "lower-alpha",
  listSpacing: 4,
  listMarkerColor: primaryColorOptions[0].value,
  listMarkerColorL2: primaryColorOptions[0].value,
  ulFontSize: "inherit",
  olFontSize: "inherit",

  // 脚注
  footnoteColor: "",
  footnoteFontSize: 12,
  footnoteHeader: "参考资料",
  footnoteHeaderColor: "",
  footnoteHeaderStyle: "left-border",

  // 提示块
  calloutStyle: "default",

  // Mermaid
  mermaidTheme: "base",
};
