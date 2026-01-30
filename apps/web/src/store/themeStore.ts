// 主题状态管理
import { create } from "zustand";
import {
  builtInThemes,
  type CustomTheme,
  type DesignerVariables,
} from "./themes/builtInThemes";
import { convertCssToWeChatDarkMode } from "@wemd/core";
import { generateCSS } from "../components/Theme/ThemeDesigner/generateCSS";

// 深色模式 CSS 转换缓存
const darkCssCache = new Map<string, string>();
const DARK_MARK = "/* wemd-wechat-dark-converted */";

const hashCss = (css: string): string => {
  let hash = 0;
  for (let i = 0; i < css.length; i++) {
    hash = (hash << 5) - hash + css.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(16);
};

const buildDarkCacheKey = (themeId: string, css: string) =>
  `${themeId}:${hashCss(css)}`;
const clearDarkCssCache = () => darkCssCache.clear();

// localStorage 键名
const CUSTOM_THEMES_KEY = "wemd-custom-themes";
const SELECTED_THEME_KEY = "wemd-selected-theme";

const canUseLocalStorage = () =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const loadCustomThemes = (): CustomTheme[] => {
  if (!canUseLocalStorage()) return [];
  try {
    const stored = localStorage.getItem(CUSTOM_THEMES_KEY);
    if (!stored) return [];
    const themes = JSON.parse(stored) as CustomTheme[];

    return themes.map((t) => {
      let newCss = t.css;
      const variables = t.designerVariables;

      if (variables) {
        if (!variables.underlineStyle) variables.underlineStyle = "solid";
        if (!variables.underlineColor)
          variables.underlineColor = "currentColor";
        newCss = generateCSS(variables);
      }

      const theme = {
        ...t,
        css: newCss,
        designerVariables: variables,
      };

      if (t.editorMode) {
        return theme;
      }

      return {
        ...theme,
        editorMode: t.designerVariables ? "visual" : "css",
      };
    });
  } catch (error) {
    console.error("加载自定义主题失败:", error);
    return [];
  }
};

// 保存自定义主题到 localStorage
const saveCustomThemes = (themes: CustomTheme[]): void => {
  if (!canUseLocalStorage()) return;
  try {
    localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(themes));
  } catch (error) {
    console.error("保存自定义主题失败:", error);
  }
};

// 保存选中主题到 localStorage
const saveSelectedTheme = (themeId: string, themeName: string): void => {
  if (!canUseLocalStorage()) return;
  try {
    localStorage.setItem(
      SELECTED_THEME_KEY,
      JSON.stringify({ id: themeId, name: themeName }),
    );
  } catch (error) {
    console.error("保存选中主题失败:", error);
  }
};

// 从 localStorage 加载选中主题
const loadSelectedTheme = (): { id: string; name: string } | null => {
  if (!canUseLocalStorage()) return null;
  try {
    const stored = localStorage.getItem(SELECTED_THEME_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch (error) {
    console.error("加载选中主题失败:", error);
    return null;
  }
};

// 初始化选中的主题（验证存在性）
const initialSelectedTheme = (() => {
  const saved = loadSelectedTheme();
  if (!saved) return null;
  const allThemes = [...builtInThemes, ...loadCustomThemes()];
  const exists = allThemes.some((t) => t.id === saved.id);
  return exists ? saved : null;
})();

/**
 * 主题 Store 接口
 */
interface ThemeStore {
  // 当前主题
  themeId: string;
  themeName: string;
  customCSS: string;

  // 自定义主题列表
  customThemes: CustomTheme[];

  // 主题操作
  selectTheme: (themeId: string) => void;
  setCustomCSS: (css: string) => void;
  getThemeCSS: (themeId: string, darkMode?: boolean) => string;

  getAllThemes: () => CustomTheme[];

  // 主题 CRUD
  createTheme: (
    name: string,
    editorMode: "visual" | "css",
    css?: string,
    designerVariables?: DesignerVariables,
  ) => CustomTheme;
  updateTheme: (
    id: string,
    updates: Partial<Pick<CustomTheme, "name" | "css" | "designerVariables">>,
  ) => void;
  deleteTheme: (id: string) => void;
  duplicateTheme: (id: string, newName: string) => CustomTheme;

  // 导入导出
  /** 导出主题为 JSON 文件（含 designerVariables，可再次导入编辑） */
  exportTheme: (id: string) => void;
  /** 导出主题为 CSS 文件（纯样式代码） */
  exportThemeCSS: (id: string) => void;
  /** 从 JSON 文件导入主题 */
  importTheme: (file: File) => Promise<boolean>;
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  themeId: initialSelectedTheme?.id ?? "default",
  themeName: initialSelectedTheme?.name ?? "默认主题",
  customCSS: "",
  customThemes: loadCustomThemes(),

  selectTheme: (themeId: string) => {
    const allThemes = get().getAllThemes();
    const theme = allThemes.find((t) => t.id === themeId);
    if (theme) {
      clearDarkCssCache();
      set({
        themeId: theme.id,
        themeName: theme.name,
        customCSS: theme.css,
      });
      saveSelectedTheme(theme.id, theme.name);
    }
  },

  setCustomCSS: (css: string) => {
    clearDarkCssCache();
    set({ customCSS: css });
  },

  getThemeCSS: (themeId: string, darkMode?: boolean) => {
    const state = get();

    // 先查找内置主题
    const builtIn = builtInThemes.find((t) => t.id === themeId);
    let css = builtIn ? builtIn.css : "";

    // 再查找自定义主题
    if (!css) {
      const custom = state.customThemes.find((t) => t.id === themeId);
      css = custom ? custom.css : builtInThemes[0].css;
    }

    // 深色模式下：使用微信颜色转换算法
    if (darkMode) {
      const cacheKey = buildDarkCacheKey(themeId, css);
      if (darkCssCache.has(cacheKey)) {
        return darkCssCache.get(cacheKey) as string;
      }
      const converted = css.includes(DARK_MARK)
        ? css
        : convertCssToWeChatDarkMode(css);
      darkCssCache.set(cacheKey, converted);
      return converted;
    }

    return css;
  },

  getAllThemes: () => {
    const state = get();
    return [...builtInThemes, ...state.customThemes];
  },

  createTheme: (
    name: string,
    editorMode: "visual" | "css",
    css?: string,
    designerVariables?: DesignerVariables,
  ) => {
    const state = get();
    const trimmedName = name.trim() || "未命名主题";
    const themeCSS = css || state.customCSS || state.getThemeCSS(state.themeId);

    const newTheme: CustomTheme = {
      id: `custom-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      name: trimmedName,
      css: themeCSS,
      isBuiltIn: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      editorMode,
      designerVariables:
        editorMode === "visual" ? designerVariables : undefined,
    };

    const nextCustomThemes = [...state.customThemes, newTheme];
    saveCustomThemes(nextCustomThemes);
    clearDarkCssCache();
    set({ customThemes: nextCustomThemes });

    return newTheme;
  },

  updateTheme: (
    id: string,
    updates: Partial<Pick<CustomTheme, "name" | "css" | "designerVariables">>,
  ) => {
    const state = get();
    const themeIndex = state.customThemes.findIndex((t) => t.id === id);

    if (themeIndex === -1) {
      console.warn(`主题 ${id} 未找到或为内置主题`);
      return;
    }

    const existingTheme = state.customThemes[themeIndex];
    const updatedTheme: CustomTheme = {
      ...existingTheme,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    const nextCustomThemes = [
      ...state.customThemes.slice(0, themeIndex),
      updatedTheme,
      ...state.customThemes.slice(themeIndex + 1),
    ];

    saveCustomThemes(nextCustomThemes);
    clearDarkCssCache();
    set({ customThemes: nextCustomThemes });

    // 如果是当前主题，更新名称
    if (state.themeId === id) {
      set({ themeName: updatedTheme.name });
    }
  },

  deleteTheme: (id: string) => {
    const state = get();
    const theme = state.customThemes.find((t) => t.id === id);

    if (!theme) {
      console.warn(`主题 ${id} 未找到或为内置主题`);
      return;
    }

    const nextCustomThemes = state.customThemes.filter((t) => t.id !== id);
    saveCustomThemes(nextCustomThemes);
    clearDarkCssCache();
    set({ customThemes: nextCustomThemes });

    // 如果删除的是当前主题，切换到默认
    if (state.themeId === id) {
      set({
        themeId: "default",
        themeName: "默认主题",
        customCSS: "",
      });
      saveSelectedTheme("default", "默认主题");
    }
  },

  duplicateTheme: (id: string, newName: string) => {
    const state = get();
    const allThemes = state.getAllThemes();
    const sourceTheme = allThemes.find((t) => t.id === id);

    if (!sourceTheme) {
      throw new Error(`主题 ${id} 未找到`);
    }

    // 复制时保留源主题的编辑模式和变量
    const editorMode = sourceTheme.editorMode || "css";
    return state.createTheme(
      newName,
      editorMode,
      sourceTheme.css,
      sourceTheme.designerVariables,
    );
  },

  exportTheme: (id: string) => {
    const state = get();
    const theme = state.customThemes.find((t) => t.id === id);
    if (!theme || theme.editorMode !== "visual" || !theme.designerVariables) {
      console.warn("只能导出可视化编辑的主题");
      return;
    }

    const exportData = {
      version: 1,
      name: theme.name,
      editorMode: "visual",
      designerVariables: theme.designerVariables,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${theme.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  /**
   * 导出主题为 CSS 文件
   * @param id - 主题 ID
   */
  exportThemeCSS: (id: string) => {
    const state = get();
    const theme = state.customThemes.find((t) => t.id === id);
    if (!theme) {
      console.warn("主题未找到");
      return;
    }

    const blob = new Blob([theme.css], {
      type: "text/css",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${theme.name}.css`;
    a.click();
    URL.revokeObjectURL(url);
  },

  importTheme: async (file: File): Promise<boolean> => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // 验证必要字段
      if (
        typeof data.version !== "number" ||
        typeof data.name !== "string" ||
        !data.designerVariables
      ) {
        console.error("无效的主题文件格式：缺少必要字段");
        return false;
      }

      // 检查重名并添加后缀
      const existingNames = get().customThemes.map((t) => t.name);
      let finalName = data.name;
      if (existingNames.includes(finalName)) {
        let suffix = 1;
        while (existingNames.includes(`${data.name} (${suffix})`)) {
          suffix++;
        }
        finalName = `${data.name} (${suffix})`;
      }

      const css = generateCSS(data.designerVariables);
      get().createTheme(finalName, "visual", css, data.designerVariables);
      return true;
    } catch (error) {
      console.error("导入主题失败:", error);
      return false;
    }
  },
}));

// 导出内置主题供其他模块使用
export { builtInThemes };
export type { CustomTheme };
