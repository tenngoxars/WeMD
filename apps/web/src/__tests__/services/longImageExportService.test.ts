import { afterEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  renderWechatContainer: vi.fn(),
  toCanvas: vi.fn(),
}));

vi.mock("../../services/wechatCopyService", () => ({
  renderWechatContainer: mocked.renderWechatContainer,
}));
vi.mock("html-to-image", () => ({ toCanvas: mocked.toCanvas }));

const fakeCanvas = {
  width: 750,
  toBlob: (done: (blob: Blob | null) => void) => done(new Blob(["png"])),
};
vi.mock("react-hot-toast", () => ({
  default: Object.assign(vi.fn(), {
    loading: vi.fn(() => "toast-id"),
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

import {
  computeExportPixelRatio,
  exportLongImage,
} from "../../services/longImageExportService";

describe("computeExportPixelRatio", () => {
  it("普通长度的文章使用 2 倍清晰度", () => {
    expect(computeExportPixelRatio(375, 6000)).toBe(2);
  });

  it("超长文章自动降倍率，画布不超过尺寸与面积上限", () => {
    for (const height of [12_000, 40_000, 120_000]) {
      const ratio = computeExportPixelRatio(375, height);
      expect(ratio).toBeLessThan(2);
      expect(height * ratio).toBeLessThanOrEqual(16_384);
      expect(375 * ratio * height * ratio).toBeLessThanOrEqual(16_777_216);
    }
  });
});

describe("exportLongImage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mocked.renderWechatContainer.mockReset();
    mocked.toCanvas.mockReset();
  });

  it("导出进行中再次触发会被忽略，结束后（包括失败）可以再次导出", async () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:long-image");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const download = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    mocked.renderWechatContainer.mockImplementation(async () => {
      const container = document.createElement("div");
      document.body.appendChild(container);
      return { container };
    });
    mocked.toCanvas.mockResolvedValue(fakeCanvas);

    await Promise.all([
      exportLongImage("# 标题", ""),
      exportLongImage("# 标题", ""),
    ]);
    expect(mocked.renderWechatContainer).toHaveBeenCalledTimes(1);
    expect(download).toHaveBeenCalledTimes(1);

    mocked.toCanvas.mockRejectedValueOnce(new Error("boom"));
    await exportLongImage("# 标题", "");
    await exportLongImage("# 标题", "");
    expect(mocked.renderWechatContainer).toHaveBeenCalledTimes(3);
    expect(download).toHaveBeenCalledTimes(2);
  });
});
