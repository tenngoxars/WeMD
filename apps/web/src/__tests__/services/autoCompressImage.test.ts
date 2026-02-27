import { describe, expect, it, vi } from "vitest";
import {
  prepareImageForUpload,
  type ImageCompressionDependencies,
} from "../../services/image/autoCompressImage";

const MB = 1024 * 1024;

function createImageFile(
  sizeInBytes: number,
  type = "image/jpeg",
  name = "demo.jpg",
): File {
  return new File([new Uint8Array(sizeInBytes)], name, { type });
}

function createBlobOfSize(sizeInBytes: number, type = "image/jpeg"): Blob {
  return new Blob([new Uint8Array(sizeInBytes)], { type });
}

describe("prepareImageForUpload", () => {
  it("图片未超限时直接返回原图", async () => {
    const file = createImageFile(300 * 1024);
    const dependencies: ImageCompressionDependencies = {
      loadImage: vi.fn(),
      renderToBlob: vi.fn(),
    };

    const result = await prepareImageForUpload(
      file,
      { maxSizeBytes: 2 * MB },
      dependencies,
    );

    expect(result.file).toBe(file);
    expect(result.compressed).toBe(false);
    expect(result.finalSize).toBe(file.size);
    expect(dependencies.loadImage).not.toHaveBeenCalled();
    expect(dependencies.renderToBlob).not.toHaveBeenCalled();
  });

  it("超限但格式不支持时抛出明确错误", async () => {
    const file = createImageFile(3 * MB, "image/gif", "demo.gif");
    const dependencies: ImageCompressionDependencies = {
      loadImage: vi.fn(),
      renderToBlob: vi.fn(),
    };

    await expect(
      prepareImageForUpload(file, { maxSizeBytes: 2 * MB }, dependencies),
    ).rejects.toThrow("该图片格式暂不支持自动压缩，请手动压缩后重试");
  });

  it("输入体积超过上限时直接拒绝压缩", async () => {
    const file = createImageFile(5 * MB, "image/jpeg", "oversize.jpg");
    const dependencies: ImageCompressionDependencies = {
      loadImage: vi.fn(),
      renderToBlob: vi.fn(),
    };

    await expect(
      prepareImageForUpload(
        file,
        { maxSizeBytes: 2 * MB, maxInputBytes: 4 * MB },
        dependencies,
      ),
    ).rejects.toThrow("图片体积过大，暂不支持自动压缩，请先手动处理后重试");
    expect(dependencies.loadImage).not.toHaveBeenCalled();
  });

  it("输入分辨率超过上限时直接拒绝压缩", async () => {
    const file = createImageFile(3 * MB, "image/jpeg", "huge-pixel.jpg");
    const dependencies: ImageCompressionDependencies = {
      loadImage: vi.fn().mockResolvedValue({
        image: {} as CanvasImageSource,
        width: 10000,
        height: 8000,
      }),
      renderToBlob: vi.fn(),
    };

    await expect(
      prepareImageForUpload(
        file,
        { maxSizeBytes: 2 * MB, maxInputPixels: 50_000_000 },
        dependencies,
      ),
    ).rejects.toThrow("图片分辨率过高，暂不支持自动压缩，请先手动处理后重试");
    expect(dependencies.renderToBlob).not.toHaveBeenCalled();
  });

  it("超限图片会在搜索后压缩到限制内", async () => {
    const file = createImageFile(3 * MB, "image/jpeg", "photo.jpg");
    const dependencies: ImageCompressionDependencies = {
      loadImage: vi.fn().mockResolvedValue({
        image: {} as CanvasImageSource,
        width: 4000,
        height: 3000,
      }),
      renderToBlob: vi.fn().mockImplementation(({ width, quality }) => {
        const scale = width / 4000;
        const size = Math.round(
          3.4 * MB * scale * scale * (0.55 + 0.45 * quality),
        );
        return Promise.resolve(createBlobOfSize(size));
      }),
    };

    const result = await prepareImageForUpload(
      file,
      { maxSizeBytes: 2 * MB },
      dependencies,
    );

    expect(result.compressed).toBe(true);
    expect(result.file.size).toBeLessThanOrEqual(2 * MB);
    expect(result.file.name).toBe("photo.jpg");
    expect(dependencies.loadImage).toHaveBeenCalledOnce();
    expect(dependencies.renderToBlob).toHaveBeenCalled();
  });

  it("压缩后仍超限时返回失败提示", async () => {
    const file = createImageFile(4 * MB, "image/jpeg", "large.jpg");
    const dependencies: ImageCompressionDependencies = {
      loadImage: vi.fn().mockResolvedValue({
        image: {} as CanvasImageSource,
        width: 5000,
        height: 4000,
      }),
      renderToBlob: vi
        .fn()
        .mockResolvedValue(createBlobOfSize(Math.round(2.4 * MB))),
    };

    await expect(
      prepareImageForUpload(file, { maxSizeBytes: 2 * MB }, dependencies),
    ).rejects.toThrow("自动压缩后仍超过 2MB，请手动压缩后重试");
  });

  it("超大图优先使用估算缩放，减少尝试次数", async () => {
    const file = createImageFile(10 * MB, "image/jpeg", "huge.jpg");
    const renderToBlob = vi.fn().mockImplementation(({ width, quality }) => {
      const scale = width / 5000;
      const size = Math.round(
        10 * MB * scale * scale * (0.65 + 0.35 * quality),
      );
      return Promise.resolve(createBlobOfSize(size));
    });
    const dependencies: ImageCompressionDependencies = {
      loadImage: vi.fn().mockResolvedValue({
        image: {} as CanvasImageSource,
        width: 5000,
        height: 3500,
      }),
      renderToBlob,
    };

    const result = await prepareImageForUpload(
      file,
      { maxSizeBytes: 2 * MB },
      dependencies,
    );

    expect(result.compressed).toBe(true);
    expect(result.finalSize).toBeLessThanOrEqual(2 * MB);
    expect(renderToBlob).toHaveBeenCalled();
    expect(renderToBlob.mock.calls.length).toBeLessThanOrEqual(10);
  });

  it("达到编码预算后会提前结束压缩尝试", async () => {
    const file = createImageFile(12 * MB, "image/jpeg", "budget.jpg");
    const renderToBlob = vi
      .fn()
      .mockResolvedValue(createBlobOfSize(Math.round(2.6 * MB)));
    const dependencies: ImageCompressionDependencies = {
      loadImage: vi.fn().mockResolvedValue({
        image: {} as CanvasImageSource,
        width: 5200,
        height: 3600,
      }),
      renderToBlob,
    };

    await expect(
      prepareImageForUpload(
        file,
        { maxSizeBytes: 2 * MB, maxEncodeAttempts: 5 },
        dependencies,
      ),
    ).rejects.toThrow("自动压缩后仍超过 2MB，请手动压缩后重试");
    expect(renderToBlob.mock.calls.length).toBeLessThanOrEqual(5);
  });
});
