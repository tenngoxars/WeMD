// 可视化主题设计器 - 共享类型定义
// 此文件统一定义类型，供 ThemeDesigner 和 builtInThemes 共同使用

/**
 * 标题样式配置
 */
export interface HeadingStyle {
  fontSize: number;
  color: string;
  marginTop: number;
  marginBottom: number;
  preset?: string;
  centered?: boolean;
  fontWeight?: string;
  letterSpacing?: number;
}

/**
 * 可视化设计器变量
 */
export interface DesignerVariables {
  // 全局
  fontFamily: string;
  fontSize: string;
  primaryColor: string;
  lineHeight: string;
  pagePadding: number;
  baseLetterSpacing: number;

  // 标题
  h1: HeadingStyle;
  h2: HeadingStyle;
  h3: HeadingStyle;
  h4: HeadingStyle;

  // 段落
  paragraphMargin: number;
  paragraphPadding: number;
  paragraphColor: string;
  textIndent: boolean;
  textJustify: boolean;

  // 引用
  quoteBackground: string;
  quoteBorderColor: string;
  quoteTextColor: string;
  quotePreset: string;
  quoteBorderStyle: "solid" | "dashed" | "dotted" | "double";
  quoteBorderWidth: number;
  quotePaddingX: number;
  quotePaddingY: number;
  quoteFontSize: number;
  quoteLineHeight: number;
  quoteTextCentered: boolean;

  // 代码
  codeBackground: string;
  codeFontSize: number;
  inlineCodeColor: string;
  inlineCodeBackground: string;
  inlineCodeStyle: string;
  showMacBar: boolean;
  codeTheme: string;

  // 图片
  imageMargin: number;
  imageBorderRadius: number;
  imageCaptionColor: string;
  imageCaptionFontSize: number;
  imageCaptionTextAlign: string;

  // 链接/文本
  linkColor: string;
  linkUnderline: boolean;
  italicColor: string;
  delColor: string;
  markBackground: string;
  markColor: string;
  strongStyle: string;
  strongColor: string;

  // 表格
  tableHeaderBackground: string;
  tableHeaderColor: string;
  tableBorderColor: string;
  tableZebra: boolean;

  // 分割线
  hrColor: string;
  hrHeight: number;
  hrMargin: number;
  hrStyle: "solid" | "dashed" | "dotted" | "double" | "pill";

  // 列表
  ulStyle: string;
  ulStyleL2: string;
  olStyle: string;
  olStyleL2: string;
  listSpacing: number;
  listMarkerColor: string;
  listMarkerColorL2: string;
  ulFontSize: string;
  olFontSize: string;

  // 脚注
  footnoteColor: string;
  footnoteFontSize: number;
  footnoteHeader: string;
  footnoteHeaderColor: string;
  footnoteHeaderStyle: string;

  // 提示块
  calloutStyle: "default" | "primary";

  // Mermaid
  mermaidTheme: "base" | "forest" | "dark" | "neutral" | "default";
}

/**
 * 标题级别类型
 */
export type HeadingLevel = "h1" | "h2" | "h3" | "h4";

/**
 * Section Props 基础接口
 */
export interface SectionProps {
  variables: DesignerVariables;
  updateVariable: <K extends keyof DesignerVariables>(
    key: K,
    value: DesignerVariables[K],
  ) => void;
}

/**
 * 标题 Section Props
 */
export interface HeadingSectionProps extends SectionProps {
  activeHeading: HeadingLevel;
  setActiveHeading: (level: HeadingLevel) => void;
  updateHeading: (level: HeadingLevel, style: Partial<HeadingStyle>) => void;
}

/**
 * 全局 Section Props（需要主题色变更处理）
 */
export interface GlobalSectionProps extends SectionProps {
  handlePrimaryColorChange: (color: string) => void;
}
