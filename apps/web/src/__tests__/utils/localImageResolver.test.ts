import { describe, expect, it } from "vitest";
import {
  dirnameOf,
  isLocalImageSrc,
  resolveLocalImagePath,
  rewriteLocalImagesInHtml,
} from "../../utils/localImageResolver";

describe("isLocalImageSrc", () => {
  it("http/https/data/blob/wemd-file/锚点/协议相对 都视为非本地", () => {
    expect(isLocalImageSrc("http://a.com/x.png")).toBe(false);
    expect(isLocalImageSrc("https://a.com/x.png")).toBe(false);
    expect(isLocalImageSrc("data:image/png;base64,AAA")).toBe(false);
    expect(isLocalImageSrc("blob:https://a.com/id")).toBe(false);
    expect(isLocalImageSrc("wemd-file://local/xxx")).toBe(false);
    expect(isLocalImageSrc("#anchor")).toBe(false);
    expect(isLocalImageSrc("//cdn.com/x.png")).toBe(false);
  });

  it("相对路径、绝对路径、file:// 视为本地", () => {
    expect(isLocalImageSrc("./images/a.png")).toBe(true);
    expect(isLocalImageSrc("../x.png")).toBe(true);
    expect(isLocalImageSrc("images/a.png")).toBe(true);
    expect(isLocalImageSrc("C:\\x\\y.png")).toBe(true);
    expect(isLocalImageSrc("/abs/x.png")).toBe(true);
    expect(isLocalImageSrc("file:///C:/x/y.png")).toBe(true);
  });

  it("空串与前后空白", () => {
    expect(isLocalImageSrc("")).toBe(false);
    expect(isLocalImageSrc("   ")).toBe(false);
    expect(isLocalImageSrc("  ./a.png  ")).toBe(true);
  });
});

describe("dirnameOf", () => {
  it("兼容正斜杠与反斜杠", () => {
    expect(dirnameOf("C:/ws/post/a.md")).toBe("C:/ws/post");
    expect(dirnameOf("C:\\ws\\post\\a.md")).toBe("C:/ws/post");
    expect(dirnameOf("/home/u/a.md")).toBe("/home/u");
  });

  it("边界情况", () => {
    expect(dirnameOf("a.md")).toBe("a.md");
    expect(dirnameOf("/a.md")).toBe("/");
  });
});

describe("resolveLocalImagePath", () => {
  it("相对路径按 baseDir 拼接", () => {
    expect(resolveLocalImagePath("./images/a.png", "/home/u/blog")).toBe(
      "/home/u/blog/images/a.png",
    );
    expect(resolveLocalImagePath("images/a.png", "/home/u/blog")).toBe(
      "/home/u/blog/images/a.png",
    );
  });

  it("解析 .. 上级目录", () => {
    expect(resolveLocalImagePath("../x.png", "/home/u/blog")).toBe(
      "/home/u/x.png",
    );
    expect(resolveLocalImagePath("../../x.png", "C:/ws/post")).toBe("C:/x.png");
  });

  it("normalize a/../b", () => {
    expect(resolveLocalImagePath("a/../b.png", "/w")).toBe("/w/b.png");
  });

  it("绝对路径直接归一化", () => {
    expect(resolveLocalImagePath("/abs/x.png", "/home/u")).toBe("/abs/x.png");
    expect(resolveLocalImagePath("C:\\img\\x.png", "C:/ws")).toBe(
      "C:/img/x.png",
    );
  });

  it("file:// 前缀与 Windows 盘符", () => {
    expect(resolveLocalImagePath("file:///C:/img/x.png", "/w")).toBe(
      "C:/img/x.png",
    );
    expect(resolveLocalImagePath("file:///home/u/x.png", "/w")).toBe(
      "/home/u/x.png",
    );
  });

  it("baseDir 带反斜杠", () => {
    expect(resolveLocalImagePath("a.png", "C:\\ws\\post")).toBe(
      "C:/ws/post/a.png",
    );
  });
});

describe("rewriteLocalImagesInHtml", () => {
  const baseDir = "C:/ws/post";

  it("本地图片改写为 wemd-file:// 协议地址", () => {
    const html = '<p><img src="./images/a.png" alt="a"></p>';
    const out = rewriteLocalImagesInHtml(html, baseDir);
    expect(out).toContain(
      `src="wemd-file://local/${encodeURIComponent("C:/ws/post/images/a.png")}"`,
    );
    expect(out).toContain('alt="a"');
  });

  it("http 与 data: 图片不改写", () => {
    const html =
      '<img src="https://a.com/x.png"><img src="data:image/png;base64,AAA">';
    expect(rewriteLocalImagesInHtml(html, baseDir)).toBe(html);
  });

  it("同一片段中只改写本地图片", () => {
    const html = '<img src="https://a.com/x.png"><img src="../shared/b.png">';
    const out = rewriteLocalImagesInHtml(html, baseDir);
    expect(out).toContain('src="https://a.com/x.png"');
    expect(out).toContain(
      `src="wemd-file://local/${encodeURIComponent("C:/ws/shared/b.png")}"`,
    );
  });

  it("没有图片或 baseDir 为空时原样返回", () => {
    expect(rewriteLocalImagesInHtml("<p>hi</p>", baseDir)).toBe("<p>hi</p>");
    expect(rewriteLocalImagesInHtml('<img src="a.png">', "")).toBe(
      '<img src="a.png">',
    );
  });
});
