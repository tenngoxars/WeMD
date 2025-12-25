/**
 * 内置主题定义
 * 提取自 editorStore.ts，集中管理所有预设主题
 */
import {
  basicTheme,
  customDefaultTheme,
  codeGithubTheme,
  academicPaperTheme,
  auroraGlassTheme,
  bauhausTheme,
  cyberpunkNeonTheme,
  knowledgeBaseTheme,
  luxuryGoldTheme,
  morandiForestTheme,
  neoBrutalismTheme,
  receiptTheme,
  sunsetFilmTheme,
  templateTheme,
} from "@wemd/core";

// 从 ThemeDesigner 导入共享类型（解决类型重复定义问题）
import type {
  DesignerVariables,
  HeadingStyle,
} from "../../components/Theme/ThemeDesigner/types";
export type { DesignerVariables, HeadingStyle };

/**
 * 自定义主题接口
 */
export interface CustomTheme {
  id: string;
  name: string;
  css: string;
  isBuiltIn: boolean;
  createdAt: string;
  updatedAt: string;
  /** 编辑模式：创建时确定，不可更改 */
  editorMode?: "visual" | "css";
  /** 可视化设计器变量，仅 visual 模式存在 */
  designerVariables?: DesignerVariables;
}

/**
 * 主题定义接口（简化版，用于向后兼容）
 */
export interface ThemeDefinition {
  id: string;
  name: string;
  css: string;
}

/**
 * 内置主题列表
 */
export const builtInThemes: CustomTheme[] = [
  {
    id: "default",
    name: "默认主题",
    css: basicTheme + "\n" + customDefaultTheme + "\n" + codeGithubTheme,
    isBuiltIn: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "academic-paper",
    name: "学术论文",
    css: basicTheme + "\n" + academicPaperTheme + "\n" + codeGithubTheme,
    isBuiltIn: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "aurora-glass",
    name: "极光玻璃",
    css: basicTheme + "\n" + auroraGlassTheme + "\n" + codeGithubTheme,
    isBuiltIn: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "bauhaus",
    name: "包豪斯",
    css: basicTheme + "\n" + bauhausTheme + "\n" + codeGithubTheme,
    isBuiltIn: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "cyberpunk-neon",
    name: "赛博朋克",
    css: basicTheme + "\n" + cyberpunkNeonTheme + "\n" + codeGithubTheme,
    isBuiltIn: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "knowledge-base",
    name: "知识库",
    css: basicTheme + "\n" + knowledgeBaseTheme + "\n" + codeGithubTheme,
    isBuiltIn: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "luxury-gold",
    name: "黑金奢华",
    css: basicTheme + "\n" + luxuryGoldTheme + "\n" + codeGithubTheme,
    isBuiltIn: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "morandi-forest",
    name: "莫兰迪森林",
    css: basicTheme + "\n" + morandiForestTheme + "\n" + codeGithubTheme,
    isBuiltIn: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "neo-brutalism",
    name: "新粗野主义",
    css: basicTheme + "\n" + neoBrutalismTheme + "\n" + codeGithubTheme,
    isBuiltIn: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "receipt",
    name: "购物小票",
    css: basicTheme + "\n" + receiptTheme + "\n" + codeGithubTheme,
    isBuiltIn: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "sunset-film",
    name: "落日胶片",
    css: basicTheme + "\n" + sunsetFilmTheme + "\n" + codeGithubTheme,
    isBuiltIn: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "template",
    name: "主题模板",
    css: basicTheme + "\n" + templateTheme + "\n" + codeGithubTheme,
    isBuiltIn: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

/**
 * 默认主题列表（向后兼容格式）
 */
export const defaultThemes: ThemeDefinition[] = [
  {
    id: "default",
    name: "默认主题",
    css: basicTheme + "\n" + customDefaultTheme + "\n" + codeGithubTheme,
  },
];

/**
 * 获取默认主题 CSS
 */
export function getDefaultThemeCSS(): string {
  return builtInThemes[0].css;
}
