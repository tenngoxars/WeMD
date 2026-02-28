import { describe, expect, it } from "vitest";
import { defaultVariables } from "../../components/Theme/ThemeDesigner/defaults";
import { generateVariables } from "../../components/Theme/ThemeDesigner/generators/variables";

describe("theme designer variables generator", () => {
  it("keeps page padding on #wemd root for live preview", () => {
    const css = generateVariables(defaultVariables, "PingFang SC, sans-serif");

    expect(css).toContain("--wemd-page-padding: 8px;");
    expect(css).toContain("padding: 0 var(--wemd-page-padding);");
    expect(css).not.toContain("#wemd > *");
  });
});
