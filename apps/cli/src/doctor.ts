import { access } from "node:fs/promises";
import { chromium } from "playwright";

export interface DoctorResult {
  schemaVersion: 1;
  node: { version: string; supported: boolean };
  platform: {
    name: NodeJS.Platform;
    arch: string;
    openSupported: boolean;
    openCommand: string | null;
  };
  chromium: { executablePath: string; accessible: boolean };
  ok: boolean;
  warnings: string[];
}

async function accessible(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function doctor(): Promise<DoctorResult> {
  const chromiumPath = chromium.executablePath();
  const chromiumAccessible = await accessible(chromiumPath);
  const nodeSupported =
    Number.parseInt(process.versions.node.split(".")[0] || "0", 10) >= 22;
  const opener =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "explorer.exe"
        : process.platform === "linux"
          ? "xdg-open"
          : null;
  const warnings = [
    ...(nodeSupported ? [] : ["需要 Node.js >= 22"]),
    ...(chromiumAccessible ? [] : ["锁定的 Playwright Chromium 不可用"]),
    ...(opener ? [] : [`当前平台不支持 --open：${process.platform}`]),
  ];
  return {
    schemaVersion: 1,
    node: { version: process.versions.node, supported: nodeSupported },
    platform: {
      name: process.platform,
      arch: process.arch,
      openSupported: Boolean(opener),
      openCommand: opener,
    },
    chromium: { executablePath: chromiumPath, accessible: chromiumAccessible },
    ok: nodeSupported && chromiumAccessible,
    warnings,
  };
}
