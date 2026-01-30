import type { InlineContext, MarkdownExtension } from "@lezer/markdown";
import { Tag, tags } from "@lezer/highlight";

const PLUS = "+".charCodeAt(0);

const isSpace = (ch: number) =>
  ch === 32 || ch === 9 || ch === 10 || ch === 13 || ch === 12;

export const underlineTag = Tag.define(tags.emphasis);
export const underlineMarkTag = Tag.define(tags.processingInstruction);

const parseUnderline = (cx: InlineContext, next: number, pos: number) => {
  if (next !== PLUS || cx.char(pos + 1) !== PLUS || cx.char(pos + 2) === PLUS) {
    return -1;
  }

  if (pos > 0 && cx.char(pos - 1) === 92) {
    return -1;
  }

  if (isSpace(cx.char(pos + 2))) return -1;

  const elts = [cx.elt("UnderlineMark", pos, pos + 2)];

  for (let i = pos + 2; i < cx.end - 1; i++) {
    const ch = cx.char(i);
    if (ch === 92) {
      elts.push(cx.elt("Escape", i, i + 2));
      i++;
      continue;
    }

    if (ch === PLUS && cx.char(i + 1) === PLUS) {
      if (isSpace(cx.char(i - 1))) {
        i++;
        continue;
      }
      return cx.addElement(
        cx.elt(
          "Underline",
          pos,
          i + 2,
          elts.concat(cx.elt("UnderlineMark", i, i + 2)),
        ),
      );
    }
  }

  return -1;
};

export const underlineExtension: MarkdownExtension = {
  defineNodes: [
    { name: "Underline", style: { "Underline/...": underlineTag } },
    { name: "UnderlineMark", style: underlineMarkTag },
  ],
  parseInline: [{ name: "Underline", parse: parseUnderline }],
};
