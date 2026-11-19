import { describe, expect, it, vi } from "vitest";

vi.mock("../../services/wechatCopyService", () => ({
  renderWechatContainer: vi.fn(),
}));
vi.mock("html-to-image", () => ({ toCanvas: vi.fn() }));

import {
  estimateExportBytes,
  packSplitPages,
} from "../../services/longImageExportService";

const unit = (top: number, bottom: number, heading = false) => ({
  top,
  bottom,
  heading,
});

describe("packSplitPages", () => {
  it("按块边界尽量装满，不跨页切块", () => {
    const pages = packSplitPages(
      [unit(0, 400), unit(400, 800), unit(800, 1200), unit(1200, 1600)],
      1000,
    );
    expect(pages).toEqual([
      { top: 0, bottom: 800 },
      { top: 800, bottom: 1600 },
    ]);
  });

  it("页尾标题推到下一页，避免标题孤行", () => {
    const pages = packSplitPages(
      [unit(0, 400), unit(400, 500, true), unit(500, 900)],
      600,
    );
    expect(pages).toEqual([
      { top: 0, bottom: 400 },
      { top: 400, bottom: 900 },
    ]);
  });

  it("单块超高时按内部行切口分页", () => {
    const pages = packSplitPages(
      [unit(0, 2500)],
      1000,
      new Map([[0, [400, 800, 1200, 1600, 2000, 2400]]]),
    );
    expect(pages).toEqual([
      { top: 0, bottom: 800 },
      { top: 800, bottom: 1600 },
      { top: 1600, bottom: 2500 },
    ]);
  });

  it("没有合法切口时整块单独成页并允许超页", () => {
    const pages = packSplitPages([unit(0, 2500)], 1000);
    expect(pages).toEqual([{ top: 0, bottom: 2500 }]);
  });

  it("行切口都超过页高时取最近的切口，而不是整块超页", () => {
    const pages = packSplitPages(
      [unit(0, 2500)],
      1000,
      new Map([[0, [1500, 2400]]]),
    );
    expect(pages).toEqual([
      { top: 0, bottom: 1500 },
      { top: 1500, bottom: 2500 },
    ]);
  });
});

describe("estimateExportBytes", () => {
  it("按预览与导出的像素面积比例换算", () => {
    const preview = {
      height: 1000,
      pixelRatio: 1,
      pages: [{ top: 0, bottom: 1000 }],
      bytes: 100_000,
    };
    expect(estimateExportBytes(preview, 2, 375)).toBe(400_000);
  });

  it("分页按每页实际清晰度累计", () => {
    const preview = {
      height: 1000,
      pixelRatio: 1,
      pages: [
        { top: 0, bottom: 500 },
        { top: 500, bottom: 1000 },
      ],
      bytes: 100_000,
    };
    expect(estimateExportBytes(preview, 2, 375)).toBe(400_000);
  });

  it("空预览返回 0", () => {
    expect(
      estimateExportBytes(
        { height: 0, pixelRatio: 0, pages: [], bytes: 0 },
        2,
        375,
      ),
    ).toBe(0);
  });
});
