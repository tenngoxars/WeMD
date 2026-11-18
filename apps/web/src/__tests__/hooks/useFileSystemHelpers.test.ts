import { describe, expect, it } from "vitest";
import { convertToTreeItems } from "../../hooks/useFileSystemHelpers";

const updatedAt = new Date("2026-11-11T03:00:00.000Z");

describe("convertToTreeItems", () => {
  it("标题与文件名不一致时显示文件名", () => {
    const [item] = convertToTreeItems([
      {
        name: "清晰指南.md",
        path: "/workspace/清晰指南.md",
        createdAt: updatedAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
        size: 120,
        title: "新文章",
      },
    ]);

    expect(item.isDirectory).toBe(false);
    expect(item.isDirectory === false && item.title).toBe("清晰指南");
  });

  it("包含非法字符的标题按规范化文件名判断后保留", () => {
    const [item] = convertToTreeItems([
      {
        name: "产品_需求.md",
        path: "/workspace/产品_需求.md",
        createdAt: updatedAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
        size: 120,
        title: "产品/需求",
      },
    ]);

    expect(item.isDirectory === false && item.title).toBe("产品/需求");
  });

  it("同名文章自动编号时保留原标题", () => {
    const [item] = convertToTreeItems([
      {
        name: "新文章 (2).md",
        path: "/workspace/新文章 (2).md",
        createdAt: updatedAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
        size: 120,
        title: "新文章",
      },
    ]);

    expect(item.isDirectory === false && item.title).toBe("新文章");
  });
});
