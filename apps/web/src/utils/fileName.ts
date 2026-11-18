import { stripMarkdownExtension } from "./markdownFileMeta";

const INVALID_FILE_NAME_CHARS_RE = /[\\/:*?"<>|]/g;
const COUNTER_SUFFIX_RE = /^(.*) \((\d+)\)$/;

interface NormalizeMarkdownFileNameOptions {
  fallback?: string;
  maxLength?: number;
}

export function normalizeMarkdownFileName(
  input: string,
  options: NormalizeMarkdownFileNameOptions = {},
): string {
  const fallback = options.fallback ?? "未命名文章";
  const maxLength = options.maxLength ?? 60;

  const base = input.trim().replace(/\.md$/i, "");
  const normalized = base
    .replace(INVALID_FILE_NAME_CHARS_RE, "_")
    .replace(/\s+/g, " ")
    .replace(/^\.+/, "")
    .replace(/[. ]+$/g, "")
    .trim();

  const finalName = normalized || fallback;
  return `${finalName.slice(0, maxLength)}.md`;
}

export function appendMarkdownFileNameCounter(
  fileName: string,
  counter: number,
): string {
  const normalized = normalizeMarkdownFileName(fileName);
  const base = normalized.replace(/\.md$/i, "");
  return `${base} (${counter}).md`;
}

/**
 * frontmatter 标题是否仍与磁盘文件名对应。
 * 同名文章自动加 (n) 后缀时标题不变，仍视为对应。
 */
export function isTitleCompatibleWithFileName(
  name: string,
  title?: string | null,
): boolean {
  const trimmed = title?.trim();
  if (!trimmed) return false;

  const normalizedStem = stripMarkdownExtension(
    normalizeMarkdownFileName(trimmed),
  );
  const fileStem = stripMarkdownExtension(name);
  if (normalizedStem === fileStem) return true;

  const counter = fileStem.match(COUNTER_SUFFIX_RE);
  return Boolean(counter && counter[1] === normalizedStem);
}

/** 标题与文件名不一致时，以磁盘文件名为准 */
export function resolveFileTitle(name: string, title?: string | null): string {
  if (isTitleCompatibleWithFileName(name, title)) return title!.trim();
  return stripMarkdownExtension(name);
}
