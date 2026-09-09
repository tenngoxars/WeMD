import { basicTheme } from "./basic";
import { codeGithubDarkTheme } from "./code-github-dark";
import { codeGithubTheme } from "./code-github";
import { customDefaultTheme } from "./custom-default";
import { academicPaperTheme } from "./academic-paper";
import { auroraGlassTheme } from "./aurora-glass";
import { bauhausTheme } from "./bauhaus";
import { cyberpunkNeonTheme } from "./cyberpunk-neon";
import { clearGuideTheme } from "./clear-guide";
import { dataBlueprintTheme } from "./data-blueprint";
import { easternNotesTheme } from "./eastern-notes";
import { knowledgeBaseTheme } from "./knowledge-base";
import { luxuryGoldTheme } from "./luxury-gold";
import { morandiForestTheme } from "./morandi-forest";
import { modernEditorialTheme } from "./modern-editorial";
import { neoBrutalismTheme } from "./neo-brutalism";
import { receiptTheme } from "./receipt";
import { sunsetFilmTheme } from "./sunset-film";
import { templateTheme } from "./template";
import { whitespaceGalleryTheme } from "./whitespace-gallery";

export interface BuiltInThemeCatalogEntry {
  id: string;
  name: string;
  css: string;
  isSelectable: boolean;
}

const composed = (base: string, decoration: string, code: string): string =>
  `${base}\n${decoration}\n${code}`;

/** The single source of truth for built-in theme metadata and CSS. */
export const builtInThemeCatalog: readonly BuiltInThemeCatalogEntry[] = [
  {
    id: "default",
    name: "默认主题",
    css: composed(basicTheme, customDefaultTheme, codeGithubTheme),
    isSelectable: true,
  },
  {
    id: "data-blueprint",
    name: "数据蓝图",
    css: composed(basicTheme, dataBlueprintTheme, codeGithubDarkTheme),
    isSelectable: true,
  },
  {
    id: "eastern-notes",
    name: "东方笺谱",
    css: composed(basicTheme, easternNotesTheme, codeGithubDarkTheme),
    isSelectable: true,
  },
  {
    id: "clear-guide",
    name: "清晰指南",
    css: composed(basicTheme, clearGuideTheme, codeGithubDarkTheme),
    isSelectable: true,
  },
  {
    id: "whitespace-gallery",
    name: "留白画册",
    css: composed(basicTheme, whitespaceGalleryTheme, codeGithubDarkTheme),
    isSelectable: true,
  },
  {
    id: "academic-paper",
    name: "学术论文",
    css: composed(basicTheme, academicPaperTheme, codeGithubTheme),
    isSelectable: true,
  },
  {
    id: "aurora-glass",
    name: "极光玻璃",
    css: composed(basicTheme, auroraGlassTheme, codeGithubTheme),
    isSelectable: false,
  },
  {
    id: "bauhaus",
    name: "包豪斯",
    css: composed(basicTheme, bauhausTheme, codeGithubTheme),
    isSelectable: false,
  },
  {
    id: "cyberpunk-neon",
    name: "赛博朋克",
    css: composed(basicTheme, cyberpunkNeonTheme, codeGithubTheme),
    isSelectable: false,
  },
  {
    id: "knowledge-base",
    name: "知识库",
    css: composed(basicTheme, knowledgeBaseTheme, codeGithubTheme),
    isSelectable: true,
  },
  {
    id: "luxury-gold",
    name: "黑金奢华",
    css: composed(basicTheme, luxuryGoldTheme, codeGithubTheme),
    isSelectable: true,
  },
  {
    id: "morandi-forest",
    name: "莫兰迪森林",
    css: composed(basicTheme, morandiForestTheme, codeGithubTheme),
    isSelectable: true,
  },
  {
    id: "modern-editorial",
    name: "编辑部手记",
    css: composed(basicTheme, modernEditorialTheme, codeGithubDarkTheme),
    isSelectable: true,
  },
  {
    id: "neo-brutalism",
    name: "新粗野主义",
    css: composed(basicTheme, neoBrutalismTheme, codeGithubTheme),
    isSelectable: false,
  },
  {
    id: "receipt",
    name: "购物小票",
    css: composed(basicTheme, receiptTheme, codeGithubTheme),
    isSelectable: true,
  },
  {
    id: "sunset-film",
    name: "落日胶片",
    css: composed(basicTheme, sunsetFilmTheme, codeGithubTheme),
    isSelectable: true,
  },
  {
    id: "template",
    name: "主题模板",
    css: composed(basicTheme, templateTheme, codeGithubTheme),
    isSelectable: false,
  },
] as const;

export const getBuiltInTheme = (
  id: string,
): BuiltInThemeCatalogEntry | undefined =>
  builtInThemeCatalog.find((theme) => theme.id === id);
