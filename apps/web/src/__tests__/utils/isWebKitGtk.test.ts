import { describe, expect, it } from "vitest";
import { isWebKitGtk } from "../../utils/isWebKitGtk";

describe("isWebKitGtk", () => {
  it("只命中 Linux 上的 WebKitGTK", () => {
    expect(
      isWebKitGtk(
        "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0",
      ),
    ).toBe(false);
    expect(
      isWebKitGtk(
        "Mozilla/5.0 (X11; Ubuntu; Linux x86_64) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
      ),
    ).toBe(true);
    expect(
      isWebKitGtk(
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      ),
    ).toBe(false);
  });
});
