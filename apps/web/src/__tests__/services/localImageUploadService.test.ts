import { describe, expect, it, vi } from "vitest";
import {
  base64ToFile,
  collectLocalImageRefs,
  uploadLocalImagesInMarkdown,
  type UploadLocalImagesDeps,
} from "../../services/image/localImageUploadService";

const BASE_DIR = "/ws/post";

// 构造可用的 readImage mock：按路径返回 1x1 的 base64 数据
const makeReadImage = (
  overrides: Record<
    string,
    | { success: true; data: string; mime: string }
    | { success: false; error: string }
  > = {},
) =>
  vi.fn(async (absPath: string) => {
    const hit = overrides[absPath];
    if (hit) return hit;
    return {
      success: true as const,
      data: btoa(`bytes:${absPath}`),
      mime: "image/png",
    };
  });

const makeUpload = () =>
  vi.fn(async (file: File) => `https://cdn.example.com/${file.name}`);

describe("collectLocalImageRefs", () => {
  it("收集本地图片并按绝对路径去重", () => {
    const md = [
      "![a](./images/a.png)",
      "![b](https://cdn.com/x.png)",
      "![c](../shared/c.png)",
      "![a2](./images/a.png)",
    ].join("\n");
    const refs = collectLocalImageRefs(md, BASE_DIR);
    expect(refs.map((r) => r.absPath)).toEqual([
      "/ws/post/images/a.png",
      "/ws/shared/c.png",
    ]);
  });

  it("支持 title 与尖括号形式", () => {
    const md = '![a](a.png "标题")\n![b](<b.png>)';
    const refs = collectLocalImageRefs(md, BASE_DIR);
    expect(refs.map((r) => r.src)).toEqual(["a.png", "b.png"]);
  });

  it("同一文件的不同 src 写法合并到同一条记录", () => {
    const md = "![a](./a.png)\n![a2](a.png)";
    const refs = collectLocalImageRefs(md, BASE_DIR);
    expect(refs).toHaveLength(1);
    expect(refs[0].srcs).toEqual(["./a.png", "a.png"]);
  });
});

describe("uploadLocalImagesInMarkdown", () => {
  it("正常替换多张本地图片", async () => {
    const md = "![a](a.png)\n![b](b.png)";
    const readImage = makeReadImage();
    const upload = makeUpload();
    const deps: UploadLocalImagesDeps = { readImage, upload };

    const result = await uploadLocalImagesInMarkdown(md, BASE_DIR, deps);
    expect(result.uploaded).toBe(2);
    expect(result.failed).toEqual([]);
    expect(result.markdown).toBe(
      "![a](https://cdn.example.com/a.png)\n![b](https://cdn.example.com/b.png)",
    );
  });

  it("同一图片多处引用只上传一次，但全部替换", async () => {
    const md = "![a](a.png)\n文字\n![a2](a.png)";
    const readImage = makeReadImage();
    const upload = makeUpload();

    const result = await uploadLocalImagesInMarkdown(md, BASE_DIR, {
      readImage,
      upload,
    });
    expect(upload).toHaveBeenCalledTimes(1);
    expect(readImage).toHaveBeenCalledTimes(1);
    expect(result.uploaded).toBe(1);
    expect(result.markdown).toBe(
      "![a](https://cdn.example.com/a.png)\n文字\n![a2](https://cdn.example.com/a.png)",
    );
  });

  it("同一图片的不同 src 写法也会被替换", async () => {
    const md = "![a](./a.png)\n![a2](a.png)";
    const result = await uploadLocalImagesInMarkdown(md, BASE_DIR, {
      readImage: makeReadImage(),
      upload: makeUpload(),
    });
    expect(result.uploaded).toBe(1);
    expect(result.markdown).toBe(
      "![a](https://cdn.example.com/a.png)\n![a2](https://cdn.example.com/a.png)",
    );
  });

  it("http 图片跳过，不触发上传", async () => {
    const md = "![x](https://cdn.com/x.png)";
    const readImage = makeReadImage();
    const upload = makeUpload();

    const result = await uploadLocalImagesInMarkdown(md, BASE_DIR, {
      readImage,
      upload,
    });
    expect(result.uploaded).toBe(0);
    expect(result.markdown).toBe(md);
    expect(readImage).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });

  it("单张失败不影响其他图片", async () => {
    const md = "![a](a.png)\n![b](b.png)";
    const readImage = makeReadImage({
      "/ws/post/a.png": { success: false, error: "File not found" },
    });
    const upload = makeUpload();

    const result = await uploadLocalImagesInMarkdown(md, BASE_DIR, {
      readImage,
      upload,
    });
    expect(result.uploaded).toBe(1);
    expect(result.failed).toEqual([{ src: "a.png", reason: "File not found" }]);
    expect(result.markdown).toBe(
      "![a](a.png)\n![b](https://cdn.example.com/b.png)",
    );
  });

  it("替换时保留 alt 与 title", async () => {
    const md = '![描述](a.png "图片标题")';
    const result = await uploadLocalImagesInMarkdown(md, BASE_DIR, {
      readImage: makeReadImage(),
      upload: makeUpload(),
    });
    expect(result.markdown).toBe(
      '![描述](https://cdn.example.com/a.png "图片标题")',
    );
  });

  it("onProgress 逐张汇报进度", async () => {
    const md = "![a](a.png)\n![b](b.png)";
    const progress: Array<[number, number]> = [];
    await uploadLocalImagesInMarkdown(md, BASE_DIR, {
      readImage: makeReadImage(),
      upload: makeUpload(),
      onProgress: (done, total) => progress.push([done, total]),
    });
    expect(progress).toEqual([
      [1, 2],
      [2, 2],
    ]);
  });
});

describe("base64ToFile", () => {
  const readAsText = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });

  const readAsBytes = (file: File): Promise<Uint8Array> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve(new Uint8Array(reader.result as ArrayBuffer));
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });

  it("正确还原字节内容", async () => {
    const file = base64ToFile(btoa("hello"), "a.png", "image/png");
    expect(file.name).toBe("a.png");
    expect(file.type).toBe("image/png");
    expect(file.size).toBe(5);
    expect(await readAsText(file)).toBe("hello");
  });

  it("支持二进制字节", async () => {
    const bytes = new Uint8Array([0, 1, 2, 255]);
    const file = base64ToFile(
      btoa(String.fromCharCode(...bytes)),
      "b.bin",
      "application/octet-stream",
    );
    expect(await readAsBytes(file)).toEqual(bytes);
  });
});
