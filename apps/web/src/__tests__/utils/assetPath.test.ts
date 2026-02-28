import { describe, expect, it } from "vitest";
import { resolveAppAssetPath } from "../../utils/assetPath";

describe("resolveAppAssetPath", () => {
  it("uses relative base for packaged app", () => {
    expect(resolveAppAssetPath("favicon-dark.svg", "./")).toBe(
      "./favicon-dark.svg",
    );
  });

  it("strips leading slash from filename", () => {
    expect(resolveAppAssetPath("/favicon-dark.svg", "./")).toBe(
      "./favicon-dark.svg",
    );
  });

  it("works with absolute root base", () => {
    expect(resolveAppAssetPath("favicon-light.svg", "/")).toBe(
      "/favicon-light.svg",
    );
  });

  it("works with nested base path", () => {
    expect(resolveAppAssetPath("favicon-dark.svg", "/app/")).toBe(
      "/app/favicon-dark.svg",
    );
  });
});
