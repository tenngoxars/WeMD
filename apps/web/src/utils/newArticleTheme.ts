interface ThemeStateLike {
  themeId?: string;
  themeName?: string;
  customCSS?: string;
}

interface ThemeOptionLike {
  id: string;
  name: string;
}

export interface NewArticleThemeSnapshot {
  themeId: string;
  themeName: string;
  customCSS: string;
}

export const DEFAULT_NEW_ARTICLE_THEME: NewArticleThemeSnapshot = {
  themeId: "default",
  themeName: "默认主题",
  customCSS: "",
};

export function resolveNewArticleThemeSnapshot(
  themeState: ThemeStateLike,
  themes: ThemeOptionLike[],
): NewArticleThemeSnapshot {
  const matchedTheme = themes.find((item) => item.id === themeState.themeId);
  if (!matchedTheme) {
    return { ...DEFAULT_NEW_ARTICLE_THEME };
  }

  return {
    themeId: matchedTheme.id,
    themeName: matchedTheme.name || themeState.themeName || "默认主题",
    customCSS: themeState.customCSS ?? "",
  };
}
