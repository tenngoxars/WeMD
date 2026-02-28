/**
 * 纯文本级别的 CSS 变量展开
 * 将 CSS 中的 var(--wemd-*) 引用替换为具体值，消除对运行时 DOM 的依赖
 */
import {
  findNextVarStart,
  findMatchingParen,
  splitVarArgs,
} from "./cssVarParser";

/**
 * 从 CSS 文本中提取所有自定义属性声明
 * 返回 variableName → value 的映射
 */
const extractCustomProperties = (css: string): Map<string, string> => {
  const vars = new Map<string, string>();
  const regex = /(--[\w-]+)\s*:\s*([^;]+);/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(css)) !== null) {
    vars.set(match[1].trim(), match[2].trim());
  }
  return vars;
};

/**
 * 递归展开字符串中的所有 var() 引用
 */
const resolveVarReferences = (
  value: string,
  vars: Map<string, string>,
  resolving: Set<string>,
): string => {
  let result = "";
  let cursor = 0;

  while (cursor < value.length) {
    const varIndex = findNextVarStart(value, cursor);
    if (varIndex < 0) {
      result += value.slice(cursor);
      break;
    }

    result += value.slice(cursor, varIndex);

    const openParen = varIndex + 3;
    const closeIndex = findMatchingParen(value, openParen);
    if (closeIndex < 0) {
      result += value.slice(varIndex);
      break;
    }

    const rawArgs = value.slice(openParen + 1, closeIndex);
    const [varName, fallback] = splitVarArgs(rawArgs);

    let replacement: string | null = null;

    if (varName.startsWith("--") && !resolving.has(varName)) {
      const varValue = vars.get(varName);
      if (varValue !== undefined) {
        const nextResolving = new Set(resolving);
        nextResolving.add(varName);
        const resolved = resolveVarReferences(varValue, vars, nextResolving);
        if (resolved.includes("var(") && fallback) {
          replacement = resolveVarReferences(
            fallback,
            vars,
            new Set(resolving),
          );
        } else {
          replacement = resolved;
        }
      } else if (fallback) {
        replacement = resolveVarReferences(fallback, vars, new Set(resolving));
      }
    } else if (fallback) {
      replacement = resolveVarReferences(fallback, vars, new Set(resolving));
    }

    result += replacement ?? `var(${rawArgs})`;
    cursor = closeIndex + 1;
  }

  return result;
};

/**
 * 移除 CSS 规则块中的自定义属性声明行，保留其他属性
 * 如果清理后规则块为空，整个规则块会被移除
 */
const stripCustomPropertyDeclarations = (css: string): string => {
  return css.replace(
    /([^{}]*)\{([^{}]*)\}/gs,
    (_match, selector: string, body: string) => {
      const lines = body
        .split(";")
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith("--"));
      if (lines.length === 0) return "";
      return `${selector.trim()} { ${lines.join("; ")}; }`;
    },
  );
};

/**
 * 对 CSS 文本进行纯文本级别的变量展开
 * 1. 提取所有 --* 变量声明
 * 2. 将所有 var(--*) 引用替换为具体值
 * 3. 移除变量声明（微信不支持 CSS 变量）
 */
export const expandCSSVariables = (css: string): string => {
  if (!css) return css;

  const hasVar = css.includes("var(");
  const vars = extractCustomProperties(css);
  const hasCustomProps = vars.size > 0;

  if (!hasVar && !hasCustomProps) return css;

  let expanded = css;

  if (hasVar) {
    const resolvedVars = new Map<string, string>();
    for (const [name, value] of vars) {
      resolvedVars.set(
        name,
        resolveVarReferences(value, vars, new Set([name])),
      );
    }
    expanded = resolveVarReferences(expanded, resolvedVars, new Set());
  }

  if (hasCustomProps) {
    expanded = stripCustomPropertyDeclarations(expanded);
  }

  return expanded;
};
