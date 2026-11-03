// 迁移导出：把白名单内的 localStorage 写到 userData/wemd-migration.json，供 Tauri 版首次启动时导入
import type { WebContents } from "electron";
import * as fs from "fs";
import * as path from "path";

// 白名单需与 apps/desktop/src-tauri/src/migration.rs 的 MIGRATION_KEYS 保持同步
export const MIGRATION_KEYS = [
  "wemd-ai-config",
  "imageHostConfigs",
  "imageHostConfig",
  "wemd-workspace-path",
  "wemd-last-file-path",
  "wemd-selected-theme",
  "wemd-custom-themes",
  "wemd-format-options",
  "wemd-link-to-footnote",
  "wemd-table-wrap",
  "wemd-ui-theme",
  "wemd-header-autohide",
  "wemd-show-history",
  "wemd-editor-pane-width",
  "wemd-editor-pane-ratio",
  "wemd-file-sort-mode",
  "wemd-folder-collapsed",
] as const;

export const MIGRATION_FILE = "wemd-migration.json";
export const MIGRATION_VERSION = 1;

/** 只保留白名单内、值为字符串的键 */
export function buildPayload(raw: unknown, now = new Date()) {
  const entries: Record<string, string> = {};
  if (raw && typeof raw === "object") {
    const source = raw as Record<string, unknown>;
    for (const key of MIGRATION_KEYS) {
      if (typeof source[key] === "string") entries[key] = source[key] as string;
    }
  }
  return {
    version: MIGRATION_VERSION,
    exportedAt: now.toISOString(),
    entries,
  };
}

/** 原子写入，仅当前用户可读写（Windows 上 mode 基本无效，靠用户目录本身的 ACL） */
export function writeMigrationFile(dir: string, payload: unknown): string {
  const target = path.join(dir, MIGRATION_FILE);
  const tmp = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(payload), { mode: 0o600 });
  fs.chmodSync(tmp, 0o600);
  fs.renameSync(tmp, target);
  return target;
}

const READ_SCRIPT = `(() => {
  const out = {};
  for (const key of ${JSON.stringify(MIGRATION_KEYS)}) {
    const value = localStorage.getItem(key);
    if (value !== null) out[key] = value;
  }
  return out;
})()`;

// userData 由调用方传入：本模块不在运行时引用 electron，便于 node:test 直接测试
export async function exportSettings(
  contents: WebContents,
  userDataDir: string,
): Promise<void> {
  try {
    const raw = await contents.executeJavaScript(READ_SCRIPT);
    writeMigrationFile(userDataDir, buildPayload(raw));
  } catch (error) {
    // 只记录错误类型，避免日志带出配置内容
    console.error(
      "[WeMD] 导出迁移设置失败:",
      error instanceof Error ? error.name : "unknown",
    );
  }
}

export interface ClosableWindow {
  on(
    event: "close",
    listener: (event: { preventDefault(): void }) => void,
  ): unknown;
  close(): void;
  isDestroyed(): boolean;
}

/**
 * 关窗前再导出一次，保证最后一次会话的设置也进文件。
 * 所有关窗路径（标题栏、window:close、app 退出、macOS 关窗）都会触发 close 事件；
 * 导出完成或超时后才真正关闭，期间重复的 close 被吞掉。
 */
export function exportOnClose(
  win: ClosableWindow,
  run: () => Promise<void>,
  afterClose: () => void = () => {},
  timeoutMs = 1500,
): void {
  let state: "idle" | "exporting" | "done" = "idle";
  win.on("close", (event) => {
    if (state === "done") return;
    event.preventDefault();
    if (state === "exporting") return;
    state = "exporting";
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, timeoutMs);
    });
    void Promise.race([run().catch(() => {}), timeout]).then(() => {
      clearTimeout(timer);
      state = "done";
      if (!win.isDestroyed()) win.close();
      afterClose();
    });
  });
}
