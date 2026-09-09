import { describe, expect, it } from "vitest";
import {
  applyMarkdownFileMeta,
  buildMarkdownFileContent,
  parseMarkdownFileContent,
  stripMarkdownExtension,
} from "../markdownFileMeta";

describe("markdownFileMeta core API", () => {
  it("parses quoted frontmatter metadata", () => {
    const parsed = parseMarkdownFileContent(`---
theme: modern-editorial
themeName: "编辑部手记"
title: "A/B 标题"
---

# 正文
`);

    expect(parsed).toMatchObject({
      theme: "modern-editorial",
      themeName: "编辑部手记",
      title: "A/B 标题",
      body: "# 正文\n",
    });
  });

  it("defaults metadata when frontmatter is absent", () => {
    expect(parseMarkdownFileContent("正文")).toEqual({
      body: "正文",
      theme: "default",
      themeName: "默认主题",
    });
  });

  it("builds metadata that can be parsed again", () => {
    const output = buildMarkdownFileContent({
      body: "内容",
      theme: "receipt",
      themeName: "购物小票",
      title: "产品/需求",
    });

    expect(parseMarkdownFileContent(output)).toMatchObject({
      body: "内容",
      theme: "receipt",
      themeName: "购物小票",
      title: "产品/需求",
    });
  });

  it("preserves BOM, CRLF, and unknown frontmatter fields", () => {
    const source =
      '\uFEFF---\r\ntitle: 标题\r\nauthor: "Alice"\r\ntags: [a, b]\r\n---\r\n\r\n旧正文\r\n';
    const output = applyMarkdownFileMeta(source, {
      body: "新正文",
      theme: "default",
      themeName: "默认主题",
      title: "标题",
    });

    expect(output.startsWith("\uFEFF---\r\n")).toBe(true);
    expect(output).toContain('author: "Alice"');
    expect(output).toContain("tags: [a, b]");
    expect(output).toContain('themeName: "默认主题"');
    expect(
      output
        .split("\r\n")
        .filter((line) => line.replace("\uFEFF", "") === "---"),
    ).toHaveLength(2);
  });

  it("strips a Markdown extension case-insensitively", () => {
    expect(stripMarkdownExtension("Article.MD")).toBe("Article");
  });
});
