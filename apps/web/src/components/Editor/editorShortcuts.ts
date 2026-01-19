import { EditorView } from "codemirror";
import { keymap } from "@codemirror/view";
import { Prec } from "@codemirror/state";
import { indentWithTab } from "@codemirror/commands";

// 跨平台快捷键处理
const isMac =
  typeof navigator !== "undefined" ? /Mac/.test(navigator.userAgent) : true;
const imageShortcut = isMac ? "Mod-Control-i" : "Mod-Alt-i";

// 辅助函数：用 prefix/suffix 包裹选中文本
function wrapSelection(
  view: EditorView,
  prefix: string,
  suffix: string,
): boolean {
  const selection = view.state.selection.main;
  const selectedText = view.state.doc.sliceString(selection.from, selection.to);
  const wrapped = prefix + (selectedText || "文本") + suffix;

  view.dispatch({
    changes: { from: selection.from, to: selection.to, insert: wrapped },
    selection: selectedText
      ? { anchor: selection.from, head: selection.from + wrapped.length }
      : {
          anchor: selection.from + prefix.length,
          head: selection.from + prefix.length + 2,
        },
  });
  return true; // 阻止浏览器默认行为
}

// 辅助函数：切换标题
function toggleHeader(view: EditorView, level: number): boolean {
  const { state, dispatch } = view;
  const { from, to } = state.selection.main;
  const line = state.doc.lineAt(from);
  const lineText = line.text;

  const match = lineText.match(/^(#{1,6})\s/);
  const currentLevel = match ? match[1].length : 0;

  let changes;
  if (currentLevel === level) {
    changes = {
      from: line.from,
      to: line.from + level + 1,
      insert: "",
    };
  } else {
    const prefix = "#".repeat(level) + " ";
    changes = {
      from: line.from,
      to: line.from + (currentLevel ? currentLevel + 1 : 0),
      insert: prefix,
    };
  }

  const lengthChange = changes.insert.length - (changes.to - changes.from);
  const newHeaderPos =
    state.selection.main.head === line.from
      ? line.from + changes.insert.length
      : state.selection.main.head + lengthChange;

  dispatch({
    changes,
    selection: { anchor: newHeaderPos, head: newHeaderPos },
  });
  return true;
}

// 辅助函数：插入或包裹块级元素
function wrapBlock(view: EditorView, prefix: string, suffix: string): boolean {
  const { state, dispatch } = view;
  const { from, to } = state.selection.main;
  const text = state.doc.sliceString(from, to);

  const hasLineBreak =
    text.includes("\n") || from === state.doc.lineAt(from).from;

  const insertText = hasLineBreak
    ? `${prefix}\n${text}\n${suffix}`
    : `\n${prefix}\n${text}\n${suffix}\n`;

  dispatch({
    changes: { from, to, insert: insertText },
    selection: {
      anchor:
        from +
        (hasLineBreak ? prefix.length + 1 : prefix.length + 2) +
        text.length,
    },
  });
  return true;
}

// 辅助函数：切换列表
function toggleList(view: EditorView, prefix: string): boolean {
  const { state, dispatch } = view;
  const { from, to } = state.selection.main;
  const line = state.doc.lineAt(from);

  if (line.text.trim().startsWith(prefix.trim())) {
    const delLen = prefix.length;
    dispatch({
      changes: { from: line.from, to: line.from + delLen, insert: "" },
      selection: {
        anchor: state.selection.main.head - delLen,
        head: state.selection.main.head - delLen,
      },
    });
  } else {
    dispatch({
      changes: { from: line.from, insert: prefix },
      selection: {
        anchor: state.selection.main.head + prefix.length,
        head: state.selection.main.head + prefix.length,
      },
    });
  }
  return true;
}

// Markdown 格式化快捷键配置
export const customKeymap = Prec.highest(
  keymap.of([
    { key: "Mod-b", run: (view) => wrapSelection(view, "**", "**") },
    { key: "Mod-i", run: (view) => wrapSelection(view, "*", "*") },
    { key: "Mod-u", run: (view) => wrapSelection(view, "<u>", "</u>") },
    { key: "Mod-Shift-x", run: (view) => wrapSelection(view, "~~", "~~") },
    { key: "Mod-Shift-k", run: (view) => wrapSelection(view, "`", "`") },
    { key: "Mod-Shift-m", run: (view) => wrapSelection(view, "$", "$") },

    { key: "Mod-1", run: (view) => toggleHeader(view, 1) },
    { key: "Mod-2", run: (view) => toggleHeader(view, 2) },
    { key: "Mod-3", run: (view) => toggleHeader(view, 3) },
    { key: "Mod-4", run: (view) => toggleHeader(view, 4) },

    { key: "Mod-Alt-l", run: (view) => toggleList(view, "- ") },
    { key: "Mod-Alt-o", run: (view) => toggleList(view, "1. ") },

    { key: "Mod-Shift-.", run: (view) => toggleList(view, "> ") },
    { key: "Mod-Alt-c", run: (view) => wrapBlock(view, "```", "```") },
    { key: "Mod-Alt-m", run: (view) => wrapBlock(view, "$$", "$$") },
    {
      key: "Mod-Alt-t",
      run: (view) =>
        wrapBlock(view, "| Feature | Description |\n| --- | --- |", "| | |"),
    },
    {
      key: "Mod-Alt--",
      run: (view) => {
        view.dispatch(view.state.replaceSelection("\n---\n"));
        return true;
      },
    },

    {
      key: "Mod-k",
      run: (view) => {
        const selection = view.state.selection.main;
        const selectedText = view.state.doc.sliceString(
          selection.from,
          selection.to,
        );
        const linkText = selectedText || "文本";
        const wrapped = `[${linkText}]()`;
        // 计算括号内的光标位置
        const cursorPos = selection.from + 1 + linkText.length + 2;
        view.dispatch({
          changes: { from: selection.from, to: selection.to, insert: wrapped },
          selection: { anchor: cursorPos, head: cursorPos },
        });
        return true;
      },
    },
    {
      key: imageShortcut,
      run: (view) => {
        const { state, dispatch } = view;
        const { from, to } = state.selection.main;
        dispatch({
          changes: { from, to, insert: "![]()" },
          selection: { anchor: from + 4 },
        });
        return true;
      },
    },
    indentWithTab,
  ]),
);
