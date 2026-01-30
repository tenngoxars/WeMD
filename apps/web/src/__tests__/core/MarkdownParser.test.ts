import { describe, it, expect } from "vitest";
import { createMarkdownParser } from "@wemd/core";

describe("MarkdownParser", () => {
  const parser = createMarkdownParser();

  it("renders headers with span", () => {
    const input = "# Hello World";
    const output = parser.render(input);
    expect(output).toContain('<span class="content">Hello World</span>');
  });

  it("renders math blocks correctly", () => {
    const input = "$$E=mc^2$$";
    const output = parser.render(input);
    expect(output).toContain('class="block-equation"');
  });

  it("renders image flow", () => {
    const input = "<![img1](1.png),![img2](2.png)>";
    const output = parser.render(input);
    expect(output).toContain("imageflow-layer1");
    expect(output).toContain('<img alt="img1" src="1.png"');
    expect(output).toContain('<img alt="img2" src="2.png"');
  });

  describe("underline", () => {
    it("renders underline with plus delimiters", () => {
      const input = "++下划线++";
      const output = parser.render(input);
      expect(output).toContain("<u>下划线</u>");
    });

    it("renders triple plus as literal plus with underline", () => {
      const input = "+++下划线++";
      const output = parser.render(input);
      expect(output).toContain("+<u>下划线</u>");
    });

    it("ignores underline with leading space", () => {
      const input = "++ 下划线++";
      const output = parser.render(input);
      expect(output).not.toContain("<u>");
    });

    it("ignores underline with trailing space", () => {
      const input = "++下划线 ++";
      const output = parser.render(input);
      expect(output).not.toContain("<u>");
    });

    it("renders underline nested in bold", () => {
      const input = "**++粗体下划线++**";
      const output = parser.render(input);
      expect(output).toContain("<strong>");
      expect(output).toContain("<u>");
    });

    it("renders multiple underlines in one line", () => {
      const input = "++第一个++ 和 ++第二个++";
      const output = parser.render(input);
      const matches = output.match(/<u>/g);
      expect(matches?.length).toBe(2);
    });
  });
});
