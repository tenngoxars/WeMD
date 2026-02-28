/**
 * CSS var() 函数解析原语
 * 供 cssVariableExpander 和 inlineStyleVarResolver 共用
 */

/**
 * 在字符串中查找下一个非引号内的 var( 起始位置
 * 正确跳过引号和反斜杠转义
 */
export const findNextVarStart = (value: string, startIndex: number): number => {
  let quote: "'" | '"' | null = null;
  let escapeNext = false;

  for (let i = startIndex; i < value.length; i += 1) {
    const char = value[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === "\\") {
      escapeNext = true;
      continue;
    }

    if (quote) {
      if (char === quote) quote = null;
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }

    if (char === "v" && value.slice(i, i + 4).toLowerCase() === "var(") {
      return i;
    }
  }

  return -1;
};

/** 快速判断字符串中是否存在可解析的 var() 函数 */
export const hasVarFunction = (value: string): boolean =>
  findNextVarStart(value, 0) >= 0;

/**
 * 从 openIndex 位置（即 '(' 所在位置）开始，找到匹配的闭合括号
 * 正确处理嵌套括号、引号和反斜杠转义
 */
export const findMatchingParen = (value: string, openIndex: number): number => {
  let depth = 0;
  let quote: "'" | '"' | null = null;
  let escapeNext = false;

  for (let i = openIndex; i < value.length; i += 1) {
    const char = value[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === "\\") {
      escapeNext = true;
      continue;
    }

    if (quote) {
      if (char === quote) quote = null;
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }

    if (char === "(") {
      depth += 1;
      continue;
    }

    if (char === ")") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }

  return -1;
};

/**
 * 分割 var() 函数的参数为 [variableName, fallback]
 * 只在顶层逗号处分割，忽略嵌套函数和引号中的逗号
 */
export const splitVarArgs = (input: string): [string, string | undefined] => {
  let depth = 0;
  let quote: "'" | '"' | null = null;
  let escapeNext = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === "\\") {
      escapeNext = true;
      continue;
    }

    if (quote) {
      if (char === quote) quote = null;
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }

    if (char === "(") {
      depth += 1;
      continue;
    }

    if (char === ")") {
      depth -= 1;
      continue;
    }

    if (char === "," && depth === 0) {
      return [input.slice(0, i).trim(), input.slice(i + 1).trim()];
    }
  }

  return [input.trim(), undefined];
};
