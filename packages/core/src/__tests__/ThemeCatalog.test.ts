import { describe, expect, it } from "vitest";
import {
  basicTheme,
  builtInThemeCatalog,
  codeGithubDarkTheme,
  getBuiltInTheme,
  modernEditorialTheme,
} from "../themes";

describe("builtInThemeCatalog", () => {
  it("contains the current 17 unique built-in theme IDs", () => {
    const ids = builtInThemeCatalog.map((theme) => theme.id);

    expect(ids).toHaveLength(17);
    expect(new Set(ids).size).toBe(17);
    expect(ids[0]).toBe("default");
    expect(ids).toContain("modern-editorial");
  });

  it("keeps the exact modern-editorial CSS composition", () => {
    expect(getBuiltInTheme("modern-editorial")).toEqual(
      expect.objectContaining({
        name: "编辑部手记",
        css: `${basicTheme}\n${modernEditorialTheme}\n${codeGithubDarkTheme}`,
        isSelectable: true,
      }),
    );
  });

  it("returns undefined for unknown themes", () => {
    expect(getBuiltInTheme("not-a-theme")).toBeUndefined();
  });
});
