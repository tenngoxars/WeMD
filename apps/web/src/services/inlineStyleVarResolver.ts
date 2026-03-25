import {
  findNextVarStart,
  hasVarFunction,
  findMatchingParen,
  splitVarArgs,
} from "./cssVarParser";

const DEFAULT_LIGHT_ROOT_VARS: Record<string, string> = {
  "--ui-bg-page": "#f8f9fa",
  "--ui-bg-primary": "#ffffff",
  "--ui-bg-secondary": "#f6f8fb",
  "--ui-bg-tertiary": "#eef2f6",
  "--ui-bg-card-muted": "#f1f5f9",
  "--ui-bg-hover": "#e6f5eb",
  "--ui-text-primary": "#0f172a",
  "--ui-text-secondary": "#334155",
  "--ui-text-tertiary": "#64748b",
  "--ui-border-color": "#e2e8f0",
  "--ui-border-light": "#e2e8f0",
  "--ui-accent-primary": "#07c160",
  "--bg-page": "#f8f9fa",
  "--bg-primary": "#ffffff",
  "--bg-secondary": "#f6f8fb",
  "--bg-tertiary": "#eef2f6",
  "--bg-card-muted": "#f1f5f9",
  "--bg-hover": "#e6f5eb",
  "--text-primary": "#0f172a",
  "--text-secondary": "#334155",
  "--text-tertiary": "#64748b",
  "--border-light": "#e2e8f0",
  "--border-color": "#e2e8f0",
  "--accent-primary": "#07c160",
};

let cachedLightRootVars: Map<string, string> | null = null;

const collectLightRootVarsFromStylesheets = (): Map<string, string> => {
  const vars = new Map<string, string>();

  const visitRuleList = (rules: CSSRuleList) => {
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSStyleRule) {
        const selectors = rule.selectorText
          .split(",")
          .map((selector) => selector.trim());
        if (!selectors.includes(":root")) continue;

        for (let i = 0; i < rule.style.length; i += 1) {
          const name = rule.style.item(i);
          if (!name.startsWith("--")) continue;
          const value = rule.style.getPropertyValue(name).trim();
          if (value) vars.set(name, value);
        }
        continue;
      }

      if (rule instanceof CSSImportRule) {
        try {
          if (rule.styleSheet?.cssRules) {
            visitRuleList(rule.styleSheet.cssRules);
          }
        } catch {
          // ignore cross-origin stylesheet access errors
        }
      }
    }
  };

  for (const sheet of Array.from(document.styleSheets)) {
    try {
      if (sheet.cssRules) {
        visitRuleList(sheet.cssRules);
      }
    } catch {
      // ignore cross-origin stylesheet access errors
    }
  }

  return vars;
};

const getLightRootVars = (): Map<string, string> => {
  if (cachedLightRootVars) {
    return new Map(cachedLightRootVars);
  }

  const vars = new Map<string, string>(Object.entries(DEFAULT_LIGHT_ROOT_VARS));
  const stylesheetVars = collectLightRootVarsFromStylesheets();
  const resolvedStylesheetVars = new Map<string, string>();
  const resolveStylesheetVar = (
    name: string,
    stack: Set<string>,
  ): string | null => {
    if (resolvedStylesheetVars.has(name)) {
      return resolvedStylesheetVars.get(name) || "";
    }

    const rawValue = stylesheetVars.get(name);
    if (!rawValue) {
      return vars.get(name) || null;
    }
    if (stack.has(name)) {
      return vars.get(name) || null;
    }

    stack.add(name);
    const resolved = resolveVarFunctions(
      rawValue,
      (nestedName, nestedStack) =>
        resolveStylesheetVar(nestedName, nestedStack),
      stack,
    );
    stack.delete(name);

    if (!hasVarFunction(resolved)) {
      resolvedStylesheetVars.set(name, resolved);
      return resolved;
    }
    return vars.get(name) || null;
  };

  stylesheetVars.forEach((_value, name) => {
    const resolved = resolveStylesheetVar(name, new Set<string>());
    if (resolved) {
      vars.set(name, resolved);
    }
  });

  cachedLightRootVars = vars;
  return new Map(vars);
};

export const applyLightRootVars = (
  target: HTMLElement,
): Map<string, string> => {
  const vars = getLightRootVars();
  vars.forEach((value, name) => {
    target.style.setProperty(name, value);
  });
  return vars;
};

const resolveVarFunctions = (
  value: string,
  resolveVariable: (name: string, stack: Set<string>) => string | null,
  stack: Set<string>,
): string => {
  let output = "";
  let cursor = 0;

  while (cursor < value.length) {
    const varStart = findNextVarStart(value, cursor);
    if (varStart < 0) {
      output += value.slice(cursor);
      break;
    }

    output += value.slice(cursor, varStart);

    const openParen = varStart + 3;
    const closeParen = findMatchingParen(value, openParen);
    if (closeParen < 0) {
      output += value.slice(varStart);
      break;
    }

    const rawArgs = value.slice(openParen + 1, closeParen);
    const [rawName, rawFallback] = splitVarArgs(rawArgs);
    const variableName = rawName.trim();
    const fallback = rawFallback?.trim();
    const unresolved = `var(${rawArgs})`;

    let replacement: string | null = null;
    if (variableName.startsWith("--")) {
      const variableValue = resolveVariable(variableName, stack);
      if (variableValue !== null) {
        const nextStack = new Set(stack);
        nextStack.add(variableName);
        const resolvedVariableValue = resolveVarFunctions(
          variableValue,
          resolveVariable,
          nextStack,
        );
        if (fallback && hasVarFunction(resolvedVariableValue)) {
          replacement = resolveVarFunctions(
            fallback,
            resolveVariable,
            new Set(stack),
          );
        } else {
          replacement = resolvedVariableValue;
        }
      } else if (fallback) {
        replacement = resolveVarFunctions(
          fallback,
          resolveVariable,
          new Set(stack),
        );
      }
    } else if (fallback) {
      replacement = resolveVarFunctions(
        fallback,
        resolveVariable,
        new Set(stack),
      );
    }

    output += replacement ?? unresolved;
    cursor = closeParen + 1;
  }

  return output;
};

const resolveElementTreeVars = (
  element: HTMLElement,
  inheritedCustomVars: Map<string, string>,
) => {
  const declarations = Array.from(
    { length: element.style.length },
    (_, index) => element.style.item(index),
  )
    .filter(Boolean)
    .map((name) => ({
      name,
      value: element.style.getPropertyValue(name),
      priority: element.style.getPropertyPriority(name),
    }));

  if (declarations.length === 0) {
    const children = Array.from(element.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement,
    );
    children.forEach((child) =>
      resolveElementTreeVars(child, inheritedCustomVars),
    );
    return;
  }

  const localCustomRaw = new Map<string, string>();
  declarations.forEach(({ name, value }) => {
    if (name.startsWith("--")) {
      localCustomRaw.set(name, value);
    }
  });

  const localCustomResolved = new Map<string, string>();
  const resolveVariable = (name: string, stack: Set<string>): string | null => {
    if (localCustomResolved.has(name)) {
      return localCustomResolved.get(name) || "";
    }

    if (!localCustomRaw.has(name)) {
      return inheritedCustomVars.get(name) || null;
    }

    if (stack.has(name)) {
      return null;
    }

    stack.add(name);
    const resolved = resolveVarFunctions(
      localCustomRaw.get(name) || "",
      resolveVariable,
      stack,
    );
    stack.delete(name);
    localCustomResolved.set(name, resolved);
    return resolved;
  };

  localCustomRaw.forEach((_value, name) => {
    resolveVariable(name, new Set<string>());
  });

  const currentCustomVars = new Map(inheritedCustomVars);
  localCustomRaw.forEach((value, name) => {
    currentCustomVars.set(name, localCustomResolved.get(name) || value);
  });

  declarations.forEach(({ name, value, priority }) => {
    if (name.startsWith("--") || !hasVarFunction(value)) return;
    const resolved = resolveVarFunctions(
      value,
      (varName, stack) => {
        if (stack.has(varName)) return null;

        if (!currentCustomVars.has(varName)) {
          // 仅解析复制内容自身变量，不回退到运行时页面环境（避免暗色 UI 变量污染复制结果）
          return null;
        }

        stack.add(varName);
        const varValue = currentCustomVars.get(varName) || "";
        const varResolved = resolveVarFunctions(
          varValue,
          (nestedName, nestedStack) => {
            if (nestedStack.has(nestedName)) return null;
            return currentCustomVars.get(nestedName) || null;
          },
          stack,
        );
        stack.delete(varName);
        return varResolved;
      },
      new Set<string>(),
    );
    element.style.setProperty(name, resolved, priority);
  });

  // 微信编辑器对 CSS 变量支持不稳定，复制前移除 --token 声明，避免被清洗时连带丢失样式
  if (localCustomRaw.size > 0) {
    localCustomRaw.forEach((_value, name) => {
      element.style.removeProperty(name);
    });
  }

  if (element.style.length === 0 && element.hasAttribute("style")) {
    element.removeAttribute("style");
  }

  // 微信对 margin 简写兼容不稳定，段落额外写入长属性兜底间距
  if (element.tagName === "P") {
    const marginTop = element.style.marginTop.trim();
    const marginBottom = element.style.marginBottom.trim();
    const marginLeft = element.style.marginLeft.trim();
    const marginRight = element.style.marginRight.trim();
    if (marginTop || marginBottom || marginLeft || marginRight) {
      const styleAttr = element.getAttribute("style") || "";
      const baseStyle = styleAttr
        .replace(
          /(?:^|;)\s*margin(?:-(?:top|bottom|left|right))?\s*:[^;]*/gi,
          "",
        )
        .split(";")
        .map((item) => item.trim())
        .filter(Boolean);

      if (marginTop) baseStyle.push(`margin-top: ${marginTop}`);
      if (marginRight) baseStyle.push(`margin-right: ${marginRight}`);
      if (marginBottom) baseStyle.push(`margin-bottom: ${marginBottom}`);
      if (marginLeft) baseStyle.push(`margin-left: ${marginLeft}`);

      element.setAttribute("style", `${baseStyle.join("; ")};`);
    }
  }

  const children = Array.from(element.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement,
  );
  children.forEach((child) => resolveElementTreeVars(child, currentCustomVars));
};

export const resolveInlineStyleVariablesForCopy = (html: string): string => {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    !html ||
    !html.includes("var(")
  ) {
    return html;
  }

  const host = document.createElement("div");
  host.style.position = "absolute";
  host.style.left = "-9999px";
  host.style.top = "-9999px";
  host.style.pointerEvents = "none";
  host.style.opacity = "0";
  // 强制亮色模式，防止暗色 UI 下 getComputedStyle 回退到亮色文字默认值
  host.style.colorScheme = "light";
  host.style.color = "#000000";
  const lightRootVars = applyLightRootVars(host);
  host.innerHTML = html;

  // 临时移除 id="wemd"，阻断预览区暗色 <style> 通过 #wemd 选择器匹配到离屏容器
  const wemdRoot = host.querySelector<HTMLElement>("#wemd");
  if (wemdRoot) wemdRoot.removeAttribute("id");

  document.body.appendChild(host);

  try {
    const roots = Array.from(host.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement,
    );
    roots.forEach((root) =>
      resolveElementTreeVars(root, new Map(lightRootVars)),
    );

    // 恢复 id，后续 normalizeCopyContainer 需要它
    if (wemdRoot) wemdRoot.setAttribute("id", "wemd");
    return host.innerHTML;
  } finally {
    document.body.removeChild(host);
  }
};
