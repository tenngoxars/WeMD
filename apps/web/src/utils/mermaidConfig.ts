import type { DesignerVariables } from "../components/Theme/ThemeDesigner/types";

export interface MermaidConfig {
  theme: string;
  themeVariables: {
    primaryColor?: string;
    primaryTextColor?: string;
    primaryBorderColor?: string;
    lineColor?: string;
    secondaryColor?: string;
    tertiaryColor?: string;
    [key: string]: string | undefined;
  };
  flowchart?: {
    htmlLabels?: boolean;
    padding?: number;
    nodeSpacing?: number;
    rankSpacing?: number;
    [key: string]: any;
  };
}

/**
 * 根据设计器变量生成 Mermaid 初始化配置
 * @param designerVariables 主题设计器变量
 * @returns Mermaid 初始化配置对象
 */
export const getMermaidConfig = (
  designerVariables?: DesignerVariables,
): MermaidConfig => {
  const mermaidTheme = (designerVariables?.mermaidTheme as string) || "base";
  const mermaidFontFamily =
    designerVariables?.fontFamily ||
    '-apple-system, BlinkMacSystemFont, "Microsoft YaHei", sans-serif';

  return {
    theme: mermaidTheme,
    flowchart: {
      htmlLabels: true,
      padding: 20,
      nodeSpacing: 50,
      rankSpacing: 50,
    },
    themeVariables: {
      primaryColor: designerVariables?.primaryColor,
      primaryTextColor: designerVariables?.paragraphColor,
      primaryBorderColor: designerVariables?.primaryColor,
      lineColor: designerVariables?.primaryColor,
      secondaryColor: designerVariables?.primaryColor
        ? `${designerVariables.primaryColor}20`
        : undefined,
      tertiaryColor: "#ffffff00",
      fontFamily: mermaidFontFamily,
    },
  };
};

/**
 * 生成带有样式的 Mermaid 图表源码
 * @param diagram 原始 Mermaid 代码
 * @param config Mermaid 配置对象
 * @returns 注入了配置的 Mermaid 代码
 */
export const getThemedMermaidDiagram = (
  diagram: string,
  config: MermaidConfig,
): string => {
  if (!diagram.trim()) return "";

  // 如果用户已经手动指定了 init 指令，则不覆盖
  if (diagram.trimStart().startsWith("%%{")) {
    return diagram;
  }

  return `%%{init: ${JSON.stringify(config)} }%%\n${diagram}`;
};
