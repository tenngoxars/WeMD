// Linux 的 WebKitGTK（Tauri 桌面版、GNOME Web 等）；Linux Firefox 不含 AppleWebKit，不会命中
export const isWebKitGtk = (userAgent: string): boolean =>
  /AppleWebKit/.test(userAgent) &&
  /Linux/.test(userAgent) &&
  !/Chrom|Android/.test(userAgent);
