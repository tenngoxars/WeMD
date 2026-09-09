export interface MarkdownFileMeta {
  body: string;
  theme: string;
  themeName: string;
  title?: string;
}

export function stripMarkdownExtension(name: string): string {
  return name.replace(/\.md$/i, "");
}

interface SplitMarkdownResult {
  hasFrontmatter: boolean;
  frontmatter: string;
  body: string;
  hasBom: boolean;
  lineEnding: "\n" | "\r\n";
}

interface MarkdownFileMetaPatch {
  body?: string;
  theme?: string;
  themeName?: string;
  title?: string | null;
}

const FRONTMATTER_REGEX = /^(\uFEFF)?---(\r?\n)([\s\S]*?)\2---(?:\r?\n|$)/;

function detectLineEnding(content: string): "\n" | "\r\n" {
  return content.includes("\r\n") ? "\r\n" : "\n";
}

function parseFrontmatterValue(raw?: string): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    const quote = trimmed[0];
    const inner = trimmed.slice(1, -1);
    return quote === '"'
      ? inner.replace(/\\"/g, '"').replace(/\\\\/g, "\\")
      : inner.replace(/\\'/g, "'");
  }
  return trimmed;
}

function quoteFrontmatterValue(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function splitMarkdownContent(content: string): SplitMarkdownResult {
  const match = content.match(FRONTMATTER_REGEX);
  if (!match)
    return {
      hasFrontmatter: false,
      frontmatter: "",
      body: content,
      hasBom: content.startsWith("\uFEFF"),
      lineEnding: detectLineEnding(content),
    };
  return {
    hasFrontmatter: true,
    frontmatter: match[3],
    body: content.slice(match[0].length).trimStart(),
    hasBom: Boolean(match[1]),
    lineEnding: match[2] === "\r\n" ? "\r\n" : "\n",
  };
}

function replaceFrontmatterLine(
  raw: string,
  key: string,
  value: string,
): string {
  const lineEnding = detectLineEnding(raw);
  const lines = raw ? raw.split(/\r?\n/) : [];
  const regex = new RegExp(`^\\s*${key}\\s*:`);
  const index = lines.findIndex((line) => regex.test(line));
  const line = `${key}: ${value}`;
  if (index >= 0) lines[index] = line;
  else lines.push(line);
  return lines.join(lineEnding);
}

function removeFrontmatterLine(raw: string, key: string): string {
  if (!raw) return "";
  const lineEnding = detectLineEnding(raw);
  const regex = new RegExp(`^\\s*${key}\\s*:`);
  return raw
    .split(/\r?\n/)
    .filter((line) => !regex.test(line))
    .join(lineEnding);
}

export function parseMarkdownFileContent(content: string): MarkdownFileMeta {
  const { hasFrontmatter, frontmatter, body } = splitMarkdownContent(content);
  if (!hasFrontmatter)
    return { body: content, theme: "default", themeName: "默认主题" };
  const theme = parseFrontmatterValue(frontmatter.match(/theme:\s*(.+)/)?.[1]);
  const themeName = parseFrontmatterValue(
    frontmatter.match(/themeName:\s*(.+)/)?.[1],
  );
  const title = parseFrontmatterValue(frontmatter.match(/title:\s*(.+)/)?.[1]);
  return {
    body,
    theme: theme || "default",
    themeName: themeName || "默认主题",
    title: title?.trim() || undefined,
  };
}

export function buildMarkdownFileContent(payload: MarkdownFileMeta): string {
  return applyMarkdownFileMeta("", payload);
}

export function applyMarkdownFileMeta(
  content: string,
  patch: MarkdownFileMetaPatch,
): string {
  const split = splitMarkdownContent(content);
  const body = patch.body ?? split.body;
  let frontmatter = split.frontmatter;
  if (patch.theme !== undefined)
    frontmatter = replaceFrontmatterLine(frontmatter, "theme", patch.theme);
  if (patch.themeName !== undefined)
    frontmatter = replaceFrontmatterLine(
      frontmatter,
      "themeName",
      quoteFrontmatterValue(patch.themeName),
    );
  if (patch.title !== undefined) {
    const value = patch.title?.trim();
    frontmatter = value
      ? replaceFrontmatterLine(
          frontmatter,
          "title",
          quoteFrontmatterValue(value),
        )
      : removeFrontmatterLine(frontmatter, "title");
  }
  if (!frontmatter.trim()) return `${split.hasBom ? "\uFEFF" : ""}${body}`;
  return `${split.hasBom ? "\uFEFF" : ""}---${split.lineEnding}${frontmatter}${split.lineEnding}---${split.lineEnding}${split.lineEnding}${body}`;
}
