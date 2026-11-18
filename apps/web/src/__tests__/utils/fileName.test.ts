import { describe, expect, it } from "vitest";
import {
  appendMarkdownFileNameCounter,
  isTitleCompatibleWithFileName,
  normalizeMarkdownFileName,
  resolveFileTitle,
} from "../../utils/fileName";

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

  it("已带 md 后缀时不会重复追加", () => {
    expect(normalizeMarkdownFileName("新文章.md")).toBe("新文章.md");
  });

  it("会按 maxLength 截断", () => {
    expect(normalizeMarkdownFileName("abcdef", { maxLength: 4 })).toBe(
      "abcd.md",
    );
  });

  it("会为 Markdown 文件名追加编号", () => {
    expect(appendMarkdownFileNameCounter("新文章.md", 2)).toBe("新文章 (2).md");
  });
});

describe("resolveFileTitle", () => {
  it("保留含非法字符的原始标题", () => {
    expect(isTitleCompatibleWithFileName("产品_需求.md", "产品/需求")).toBe(
      true,
    );
    expect(resolveFileTitle("产品_需求.md", "产品/需求")).toBe("产品/需求");
  });

  it("同名文章自动编号时仍保留原标题", () => {
    expect(resolveFileTitle("新文章 (2).md", "新文章")).toBe("新文章");
  });

  it("外部改名后以磁盘文件名为准", () => {
    expect(isTitleCompatibleWithFileName("清晰指南.md", "新文章")).toBe(false);
    expect(resolveFileTitle("清晰指南.md", "新文章")).toBe("清晰指南");
  });

  it("没有 frontmatter 标题时回退文件名", () => {
    expect(resolveFileTitle("未命名.md")).toBe("未命名");
  });
});
