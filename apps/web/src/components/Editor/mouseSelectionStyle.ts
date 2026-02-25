import { EditorSelection, type EditorState } from "@codemirror/state";
import { EditorView, type ViewUpdate } from "@codemirror/view";

interface LineRange {
  from: number;
  to: number;
}

function posFromEvent(view: EditorView, event: MouseEvent): number {
  return view.posAtCoords({ x: event.clientX, y: event.clientY }, false);
}

function isParagraphBreakLine(text: string): boolean {
  return text.trim().length === 0;
}

function nonEmptyBreakLineRange(
  state: EditorState,
  line: { from: number },
): LineRange {
  if (line.from < state.doc.length) {
    return { from: line.from, to: line.from + 1 };
  }
  if (line.from > 0) {
    return { from: line.from - 1, to: line.from };
  }
  return { from: 0, to: 0 };
}

export function paragraphContentRangeAtPos(
  state: EditorState,
  pos: number,
): LineRange {
  const currentLine = state.doc.lineAt(pos);
  if (isParagraphBreakLine(currentLine.text)) {
    return nonEmptyBreakLineRange(state, currentLine);
  }

  let startLineNumber = currentLine.number;
  let endLineNumber = currentLine.number;

  while (startLineNumber > 1) {
    const prevLine = state.doc.line(startLineNumber - 1);
    if (isParagraphBreakLine(prevLine.text)) {
      break;
    }
    startLineNumber -= 1;
  }

  while (endLineNumber < state.doc.lines) {
    const nextLine = state.doc.line(endLineNumber + 1);
    if (isParagraphBreakLine(nextLine.text)) {
      break;
    }
    endLineNumber += 1;
  }

  return {
    from: state.doc.line(startLineNumber).from,
    to: state.doc.line(endLineNumber).to,
  };
}

export function mergeLineRanges(
  start: LineRange,
  current: LineRange,
): LineRange {
  return {
    from: Math.min(start.from, current.from),
    to: Math.max(start.to, current.to),
  };
}

/**
 * 覆盖 CodeMirror 默认三击选区，改为“按段落”选中（空行分段）。
 * 段落选区不包含段尾换行符，避免出现下一行行首被额外高亮。
 */
export function makeParagraphMouseSelectionStyle(
  view: EditorView,
  event: MouseEvent,
) {
  if (event.button !== 0 || event.detail < 3) {
    return null;
  }

  let startPos = posFromEvent(view, event);
  let startSelection = view.state.selection;

  return {
    update(update: ViewUpdate) {
      if (update.docChanged) {
        startPos = update.changes.mapPos(startPos);
        startSelection = startSelection.map(update.changes);
      }
    },
    get(curEvent: MouseEvent, extend: boolean, multiple: boolean) {
      const currentPos = posFromEvent(view, curEvent);
      const startRange = paragraphContentRangeAtPos(view.state, startPos);
      const currentRange = paragraphContentRangeAtPos(view.state, currentPos);
      let range = EditorSelection.range(currentRange.from, currentRange.to);

      if (startPos !== currentPos && !extend) {
        const merged = mergeLineRanges(startRange, currentRange);
        range =
          startRange.from <= currentRange.from
            ? EditorSelection.range(merged.from, merged.to)
            : EditorSelection.range(merged.to, merged.from);
      }

      if (extend) {
        return startSelection.replaceRange(
          startSelection.main.extend(range.from, range.to),
        );
      }
      if (multiple) {
        return startSelection.addRange(range);
      }
      return EditorSelection.create([range]);
    },
  };
}

export const paragraphSelectionStyle = EditorView.mouseSelectionStyle.of(
  makeParagraphMouseSelectionStyle,
);
