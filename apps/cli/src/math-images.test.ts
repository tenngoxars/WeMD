import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser } from "playwright";
import {
  optimizePngLosslessly,
  rasterizeFormulaImages,
} from "./math-images.js";

let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
});

afterAll(async () => {
  await browser.close();
});

describe("formula PNG rendering", () => {
  it("screenshots formulae at 2x, compresses them, and replaces the source DOM", async () => {
    const page = await browser.newPage({
      viewport: { width: 760, height: 400 },
      deviceScaleFactor: 2,
    });
    await page.setContent(`
        <main id="wemd" style="background:#fff;color:#102a22;font:18px Arial,sans-serif">
          公式：<span class="inline-equation" data-latex="E=mc^2"><span class="katex">E = mc²</span></span>
        </main>
      `);

    const result = await rasterizeFormulaImages(page);
    const image = page.locator("img[data-wemd-generated='formula']");
    const source = await image.getAttribute("src");
    const dimensions = await image.evaluate((node) => ({
      width: node.width,
      height: node.height,
      naturalWidth: node.naturalWidth,
      naturalHeight: node.naturalHeight,
    }));

    expect(result).toMatchObject({ total: 1, converted: 1, warnings: [] });
    expect(result.optimizedBytes).toBeLessThanOrEqual(result.rawBytes);
    expect(source).toMatch(/^data:image\/png;base64,/);
    expect(dimensions.naturalWidth).toBeGreaterThanOrEqual(
      dimensions.width * 2 - 1,
    );
    expect(dimensions.naturalHeight).toBeGreaterThanOrEqual(
      dimensions.height * 2 - 1,
    );
    expect(await page.locator(".inline-equation").count()).toBe(0);
    await page.close();
  }, 15_000);

  it("never returns a larger PNG", async () => {
    const page = await browser.newPage({
      viewport: { width: 100, height: 100 },
    });
    await page.setContent(
      '<div style="width:20px;height:20px;background:#fff"></div>',
    );
    const screenshot = await page.locator("div").screenshot({ type: "png" });
    expect(optimizePngLosslessly(screenshot).length).toBeLessThanOrEqual(
      screenshot.length,
    );
    await page.close();
  });
});
