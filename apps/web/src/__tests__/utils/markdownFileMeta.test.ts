import { describe, expect, it } from "vitest";
import {
  applyMarkdownFileMeta,
  buildMarkdownFileContent,
  parseMarkdownFileContent,
  stripMarkdownExtension,
} from "../../utils/markdownFileMeta";

describe("markdownFileMeta", () => {
  it("可以解析 frontmatter 中的 title", () => {
    const content = `---
theme: default
themeName: "默认主题"
title: "A/B 标题"
---

# 正文
`;
    const parsed = parseMarkdownFileContent(content);
    expect(parsed.theme).toBe("default");
    expect(parsed.themeName).toBe("默认主题");
    expect(parsed.title).toBe("A/B 标题");
    expect(parsed.body).toBe("# 正文\n");
  });

  it("可以构建并回读包含 title 的 markdown", () => {
    const output = buildMarkdownFileContent({
      body: "内容",
      theme: "default",
      themeName: "默认主题",
      title: "产品/需求",
    });
    const parsed = parseMarkdownFileContent(output);
    expect(parsed.title).toBe("产品/需求");
    expect(parsed.body).toBe("内容");
  });

  it("可去掉 md 后缀用于展示标题", () => {
    expect(stripMarkdownExtension("A/B.md")).toBe("A/B");
  });

  it("更新 title/theme 时保留未知 frontmatter 字段", () => {
    const source = `---
theme: default
themeName: "默认主题"
author: "Alice"
tags: [a, b]
---

正文内容
`;
    const next = applyMarkdownFileMeta(source, {
      theme: "receipt",
      themeName: "购物小票",
      title: "产品/需求",
      body: "新正文",
    });
    expect(next).toContain('author: "Alice"');
    expect(next).toContain("tags: [a, b]");
    expect(next).toContain("theme: receipt");
    expect(next).toContain('themeName: "购物小票"');
    expect(next).toContain('title: "产品/需求"');
    expect(next).toContain("\n\n新正文");
  });

  it("支持 CRLF 与 BOM 的 frontmatter，更新时不会重复生成块", () => {
    const source =
      "\uFEFF---\r\ntitle: 标题\r\ncreateTime: 2026/01/12 01:22:23\r\npermalink: /test/\r\ntags:\r\n  - tag1\r\n  - tag2\r\ncopyright:\r\n  creation: original\r\n  author:\r\n    name: Blogger\r\n---\r\n\r\n测试内容\r\n";
    const next = applyMarkdownFileMeta(source, {
      theme: "default",
      themeName: "默认主题",
      title: "标题",
      body: "测试内容",
    });

    expect(next).toContain("createTime: 2026/01/12 01:22:23");
    expect(next).toContain("permalink: /test/");
    expect(next).toContain("tags:");
    expect(next).toContain("copyright:");
    expect(next).toContain('themeName: "默认主题"');
    expect(next.startsWith("\uFEFF---\r\n")).toBe(true);
    const delimiterCount = next
      .split("\r\n")
      .filter((line) => line.replace("\uFEFF", "") === "---");
    expect(delimiterCount.length).toBe(2);
  });
});
