import { describe, expect, it } from "vitest";
import {
  DEFAULT_NEW_ARTICLE_THEME,
  resolveNewArticleThemeSnapshot,
} from "../../utils/newArticleTheme";

describe("resolveNewArticleThemeSnapshot", () => {
  it("主题存在时沿用当前主题并保留 customCSS", () => {
    const result = resolveNewArticleThemeSnapshot(
      {
        themeId: "custom-green",
        themeName: "旧名字",
        customCSS: "body { color: green; }",
      },
      [
        { id: "default", name: "默认主题" },
        { id: "custom-green", name: "森林绿" },
      ],
    );

    expect(result).toEqual({
      themeId: "custom-green",
      themeName: "森林绿",
      customCSS: "body { color: green; }",
    });
  });

  it("主题不存在时回退默认主题", () => {
    const result = resolveNewArticleThemeSnapshot(
      {
        themeId: "deleted-theme",
        themeName: "已删除主题",
        customCSS: "body { color: red; }",
      },
      [{ id: "default", name: "默认主题" }],
    );

    expect(result).toEqual(DEFAULT_NEW_ARTICLE_THEME);
  });
});
