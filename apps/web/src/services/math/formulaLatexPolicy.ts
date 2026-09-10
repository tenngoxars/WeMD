const BOLD_ITALIC_UPPER_A = 0x1d468;
const BOLD_ITALIC_LOWER_A = 0x1d482;

export const BOLDSYMBOL_COMMAND = "\\boldsymbol";

const toMathBoldItalicLatin = (value: string): string => {
  return Array.from(value)
    .map((char) => {
      const code = char.codePointAt(0);
      if (code === undefined) return char;
      if (code >= 65 && code <= 90) {
        return String.fromCodePoint(BOLD_ITALIC_UPPER_A + code - 65);
      }
      if (code >= 97 && code <= 122) {
        return String.fromCodePoint(BOLD_ITALIC_LOWER_A + code - 97);
      }
      return char;
    })
    .join("");
};

const replaceBoldSymbolWithMathbf = (latex: string): string => {
  let output = "";
  let index = 0;

  while (index < latex.length) {
    const commandIndex = latex.indexOf(BOLDSYMBOL_COMMAND, index);
    if (commandIndex === -1) {
      output += latex.slice(index);
      break;
    }

    output += latex.slice(index, commandIndex);
    let cursor = commandIndex + BOLDSYMBOL_COMMAND.length;
    while (/\s/.test(latex[cursor] || "")) cursor += 1;

    if (latex[cursor] === "{") {
      let depth = 0;
      let end = cursor;
      for (; end < latex.length; end += 1) {
        const char = latex[end];
        if (char === "{") depth += 1;
        if (char === "}") {
          depth -= 1;
          if (depth === 0) {
            end += 1;
            break;
          }
        }
      }

      if (depth !== 0) {
        output += latex.slice(commandIndex);
        return output;
      }

      output += `\\mathbf{${latex.slice(cursor + 1, end - 1)}}`;
      index = end;
      continue;
    }

    if (latex[cursor] === "\\") {
      const commandMatch = latex.slice(cursor).match(/^\\[a-zA-Z]+|^\\./);
      if (commandMatch) {
        output += `\\mathbf{${commandMatch[0]}}`;
        index = cursor + commandMatch[0].length;
        continue;
      }
    }

    if (latex[cursor]) {
      output += `\\mathbf{${latex[cursor]}}`;
      index = cursor + 1;
      continue;
    }

    output += BOLDSYMBOL_COMMAND;
    index = cursor;
  }

  return output;
};

export const getMathJaxLatexCandidates = (latex: string): string[] => {
  const mathbfLatex = replaceBoldSymbolWithMathbf(latex);
  return mathbfLatex === latex ? [latex] : [latex, mathbfLatex];
};

export const normalizeBoldSymbolText = (container: HTMLElement): void => {
  container.querySelectorAll<HTMLElement>(".boldsymbol").forEach((node) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType !== Node.TEXT_NODE || !child.textContent) return;
      child.textContent = toMathBoldItalicLatin(child.textContent);
    });
  });
};
