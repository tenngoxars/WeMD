const INVALID_FILE_NAME_CHARS_RE = /[\\/:*?"<>|]/g;

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
