import { describe, expect, it } from "vitest";
import { EditorSelection, EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import {
  makeParagraphMouseSelectionStyle,
  paragraphContentRangeAtPos,
  mergeLineRanges,
} from "../../components/Editor/mouseSelectionStyle";

function createMockView(
  doc: string,
  selection: EditorSelection = EditorSelection.cursor(0),
): EditorView {
  const state = EditorState.create({ doc, selection });
  return {
    state,
    posAtCoords: ({ x }: { x: number }) => x,
  } as unknown as EditorView;
}

function makeMouseEvent(detail: number, x: number): MouseEvent {
  return new MouseEvent("mousedown", {
    button: 0,
    detail,
    clientX: x,
    clientY: 0,
  });
}

describe("paragraphContentRangeAtPos", () => {
  it("会返回当前段落范围（空行分段）", () => {
    const state = EditorState.create({ doc: "line1\nline2\n\nline3" });

    expect(paragraphContentRangeAtPos(state, 1)).toEqual({ from: 0, to: 11 });
    expect(paragraphContentRangeAtPos(state, 13)).toEqual({ from: 13, to: 18 });
  });

  it("点击空行时只返回空行范围", () => {
    const state = EditorState.create({ doc: "a\n\nb" });

    expect(paragraphContentRangeAtPos(state, 2)).toEqual({ from: 2, to: 3 });
  });
});

describe("mergeLineRanges", () => {
  it("可以合并两个行范围", () => {
    expect(mergeLineRanges({ from: 10, to: 20 }, { from: 0, to: 5 })).toEqual({
      from: 0,
      to: 20,
    });
  });
});

describe("makeParagraphMouseSelectionStyle", () => {
  it("非三击不接管默认选区", () => {
    const view = createMockView("one\ntwo");
    const style = makeParagraphMouseSelectionStyle(view, makeMouseEvent(2, 1));
    expect(style).toBeNull();
  });

  it("三击会按段落选中（空行分段）", () => {
    const view = createMockView("one\ntwo\n\nthree");
    const style = makeParagraphMouseSelectionStyle(view, makeMouseEvent(3, 1));
    expect(style).not.toBeNull();

    const selection = style!.get(makeMouseEvent(3, 2), false, false);
    expect(selection.main.from).toBe(0);
    expect(selection.main.to).toBe(7);
  });

  it("跨段落反向拖拽时保持反向选区方向", () => {
    const view = createMockView("one\ntwo\n\nthree");
    const style = makeParagraphMouseSelectionStyle(view, makeMouseEvent(3, 10));
    expect(style).not.toBeNull();

    const selection = style!.get(makeMouseEvent(3, 1), false, false);
    expect(selection.main.anchor).toBe(14);
    expect(selection.main.head).toBe(0);
    expect(selection.main.from).toBe(0);
    expect(selection.main.to).toBe(14);
  });

  it("extend=true 时基于原选区扩展", () => {
    const baseSelection = EditorSelection.range(5, 5);
    const view = createMockView(
      "one\ntwo\n\nthree",
      EditorSelection.create([baseSelection]),
    );
    const style = makeParagraphMouseSelectionStyle(view, makeMouseEvent(3, 10));
    expect(style).not.toBeNull();

    const selection = style!.get(makeMouseEvent(3, 1), true, false);
    const expected = view.state.selection.replaceRange(
      view.state.selection.main.extend(0, 7),
    );

    expect(selection.toJSON()).toEqual(expected.toJSON());
  });

  it("multiple=true 时追加段落选区", () => {
    const baseSelection = EditorSelection.cursor(0);
    const view = createMockView(
      "one\ntwo\n\nthree",
      EditorSelection.create([baseSelection]),
    );
    const style = makeParagraphMouseSelectionStyle(view, makeMouseEvent(3, 10));
    expect(style).not.toBeNull();

    const selection = style!.get(makeMouseEvent(3, 10), false, true);
    const expected = view.state.selection.addRange(
      EditorSelection.range(9, 14),
    );

    expect(selection.toJSON()).toEqual(expected.toJSON());
  });
});
