// 工作区本地图片路径处理（纯函数，不依赖 electron / node path，可在浏览器端使用）

const NON_LOCAL_PREFIXES = [
  "http://",
  "https://",
  "data:",
  "blob:",
  "wemd-file:",
  "#",
];

// 判断 markdown 图片 src 是否指向本地文件（相对路径 / 绝对路径 / file:// 都算本地）
export function isLocalImageSrc(src: string): boolean {
  const value = src.trim();
  if (!value) return false;
  const lower = value.toLowerCase();
  if (lower.startsWith("//")) return false;
  return !NON_LOCAL_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

// 统一分隔符后解析 . 与 ..，保留 Windows 盘符
function normalizePath(value: string): string {
  const hasDrive = /^[A-Za-z]:/.test(value);
  const isAbsolute = hasDrive || value.startsWith("/");
  const stack: string[] = [];
  for (const part of value.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      const last = stack[stack.length - 1];
      // 盘符（如 C:）不可弹出；相对路径根部的 .. 保留
      const canPop = stack.length > (hasDrive ? 1 : 0) && last !== "..";
      if (canPop) stack.pop();
      else if (!isAbsolute) stack.push("..");
      continue;
    }
    stack.push(part);
  }
  const joined = stack.join("/");
  if (hasDrive) return joined;
  if (value.startsWith("/")) return "/" + joined;
  return joined;
}

// 取文件所在目录，兼容 / 与 \ 分隔符，返回值统一使用 /
export function dirnameOf(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const index = normalized.lastIndexOf("/");
  if (index < 0) return filePath;
  if (index === 0) return "/";
  return normalized.slice(0, index);
}

// 把本地图片 src 解析为绝对路径；相对路径基于 baseDir（同样兼容两种分隔符）
export function resolveLocalImagePath(src: string, baseDir: string): string {
  let value = src.trim();

  if (/^file:\/\//i.test(value)) {
    value = value.replace(/^file:\/\//i, "");
    try {
      value = decodeURIComponent(value);
    } catch {
      // 含未编码字符时按原文继续处理
    }
    // file:///C:/a.png → C:/a.png
    if (/^\/[A-Za-z]:\//.test(value)) {
      value = value.slice(1);
    }
  }

  value = value.replace(/\\/g, "/");
  const isAbsolute = /^[A-Za-z]:\//.test(value) || value.startsWith("/");
  if (isAbsolute) {
    return normalizePath(value);
  }

  const base = baseDir.replace(/\\/g, "/").replace(/\/+$/, "");
  return normalizePath(base ? `${base}/${value}` : value);
}

// 将 html 片段中指向本地图片的 <img> src 改写为 wemd-file:// 协议地址
export function rewriteLocalImagesInHtml(
  html: string,
  baseDir: string,
): string {
  if (!html || !baseDir) return html;
  const container = document.createElement("div");
  container.innerHTML = html;

  let changed = false;
  container.querySelectorAll("img").forEach((img) => {
    const src = img.getAttribute("src");
    if (!src || !isLocalImageSrc(src)) return;
    const absolutePath = resolveLocalImagePath(src, baseDir);
    img.setAttribute(
      "src",
      `wemd-file://local/${encodeURIComponent(absolutePath)}`,
    );
    changed = true;
  });

  return changed ? container.innerHTML : html;
}
