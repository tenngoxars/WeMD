export function resolveAppAssetPath(
  filename: string,
  baseUrl = import.meta.env.BASE_URL,
): string {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const normalizedFile = filename.replace(/^\/+/, "");
  return `${normalizedBase}${normalizedFile}`;
}
