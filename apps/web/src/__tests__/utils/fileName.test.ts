import { describe, expect, it } from "vitest";
import { normalizeMarkdownFileName } from "../../utils/fileName";

describe("normalizeMarkdownFileName", () => {
  it("会将路径分隔符替换为下划线", () => {
    expect(normalizeMarkdownFileName("产品/需求\\讨论")).toBe(
      "产品_需求_讨论.md",
    );
  });

  it("会移除非法字符并保留 md 后缀", () => {
    expect(normalizeMarkdownFileName('A:*?"<>|B.md')).toBe("A_______B.md");
  });

  it("输入为空时回退到默认文件名", () => {
    expect(normalizeMarkdownFileName("   ")).toBe("未命名文章.md");
  });

  it("会按 maxLength 截断", () => {
    expect(normalizeMarkdownFileName("abcdef", { maxLength: 4 })).toBe(
      "abcd.md",
    );
  });
});
