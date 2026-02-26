const findNextVarFunctionStart = (
  value: string,
  startIndex: number,
): number => {
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
      if (char === quote) {
        quote = null;
      }
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

const hasResolvableVarFunction = (value: string): boolean => {
  return findNextVarFunctionStart(value, 0) >= 0;
};

const findMatchingParenthesis = (value: string, openIndex: number): number => {
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
      if (char === quote) {
        quote = null;
      }
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
      if (depth === 0) {
        return i;
      }
    }
  }

  return -1;
};

const splitVarArguments = (input: string): [string, string | undefined] => {
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
      if (char === quote) {
        quote = null;
      }
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
      return [input.slice(0, i), input.slice(i + 1)];
    }
  }

  return [input, undefined];
};

const resolveVarFunctions = (
  value: string,
  resolveVariable: (name: string, stack: Set<string>) => string | null,
  stack: Set<string>,
): string => {
  let output = "";
  let cursor = 0;

  while (cursor < value.length) {
    const varStart = findNextVarFunctionStart(value, cursor);
    if (varStart < 0) {
      output += value.slice(cursor);
      break;
    }

    output += value.slice(cursor, varStart);

    const openParen = varStart + 3;
    const closeParen = findMatchingParenthesis(value, openParen);
    if (closeParen < 0) {
      output += value.slice(varStart);
      break;
    }

    const rawArgs = value.slice(openParen + 1, closeParen);
    const [rawName, rawFallback] = splitVarArguments(rawArgs);
    const variableName = rawName.trim();
    const fallback = rawFallback?.trim();
    const unresolved = `var(${rawArgs})`;

    let replacement: string | null = null;
    if (variableName.startsWith("--")) {
      const variableValue = resolveVariable(variableName, stack);
      if (variableValue !== null) {
        replacement = resolveVarFunctions(
          variableValue,
          resolveVariable,
          stack,
        );
      } else if (fallback) {
        replacement = resolveVarFunctions(fallback, resolveVariable, stack);
      }
    } else if (fallback) {
      replacement = resolveVarFunctions(fallback, resolveVariable, stack);
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
    if (name.startsWith("--") || !hasResolvableVarFunction(value)) return;
    const resolved = resolveVarFunctions(
      value,
      (varName, stack) => {
        if (stack.has(varName)) return null;
        if (!currentCustomVars.has(varName)) return null;
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
  host.innerHTML = html;
  document.body.appendChild(host);

  try {
    const roots = Array.from(host.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement,
    );
    roots.forEach((root) => resolveElementTreeVars(root, new Map()));
    return host.innerHTML;
  } finally {
    document.body.removeChild(host);
  }
};
