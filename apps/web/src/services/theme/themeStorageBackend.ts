// 工作区自定义主题的读写后端：桌面桥与 File System Access 两条实现
import type { StorageAdapter } from "../../storage/StorageAdapter";
import type { CustomTheme } from "../../store/themes/builtInThemes";
import type { DesktopBridge } from "../../types/desktop";
import { getDesktop } from "../../lib/platformAdapter";

/** 隐藏目录，避免主题文件进入文章列表与 watcher */
export const WORKSPACE_THEME_PATH = ".wemd/themes.json";
export const WORKSPACE_THEME_VERSION = 1;

export interface WorkspaceThemeFile {
  version: number;
  /** 标识文件夹本身；Web 端工作区名只是显示名，不能作为稳定 key */
  workspaceId: string;
  themes: CustomTheme[];
}

export interface WorkspaceThemeBackend {
  /** 文件不存在返回 null；内容损坏抛错，交由调用方保留内存与镜像 */
  read: () => Promise<WorkspaceThemeFile | null>;
  write: (data: WorkspaceThemeFile) => Promise<void>;
}

export const createWorkspaceId = (): string => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `ws-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
};

export const buildWorkspaceThemeFile = (
  themes: CustomTheme[],
  workspaceId?: string,
): WorkspaceThemeFile => ({
  version: WORKSPACE_THEME_VERSION,
  workspaceId: workspaceId || createWorkspaceId(),
  themes,
});

export const serializeWorkspaceThemeFile = (data: WorkspaceThemeFile): string =>
  JSON.stringify(data, null, 2);

export const parseWorkspaceThemeFile = (raw: string): WorkspaceThemeFile => {
  const parsed = JSON.parse(raw) as Partial<WorkspaceThemeFile>;
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.themes)) {
    throw new Error("主题文件格式不正确");
  }
  return {
    version:
      typeof parsed.version === "number"
        ? parsed.version
        : WORKSPACE_THEME_VERSION,
    workspaceId: parsed.workspaceId || createWorkspaceId(),
    themes: parsed.themes as CustomTheme[],
  };
};

class DesktopWorkspaceThemeBackend implements WorkspaceThemeBackend {
  constructor(private readonly fs: DesktopBridge["fs"]) {}

  async read(): Promise<WorkspaceThemeFile | null> {
    const result = await this.fs.readThemes();
    if (!result.success) throw new Error(result.error || "读取主题文件失败");
    if (!result.content) return null;
    return parseWorkspaceThemeFile(result.content);
  }

  async write(data: WorkspaceThemeFile): Promise<void> {
    const result = await this.fs.writeThemes(serializeWorkspaceThemeFile(data));
    if (!result.success) throw new Error(result.error || "写入主题文件失败");
  }
}

class AdapterWorkspaceThemeBackend implements WorkspaceThemeBackend {
  constructor(private readonly adapter: StorageAdapter) {}

  async read(): Promise<WorkspaceThemeFile | null> {
    if (!(await this.adapter.exists(WORKSPACE_THEME_PATH))) return null;
    const raw = await this.adapter.readFile(WORKSPACE_THEME_PATH);
    if (!raw.trim()) return null;
    return parseWorkspaceThemeFile(raw);
  }

  async write(data: WorkspaceThemeFile): Promise<void> {
    // writeFile 会逐级创建缺失目录，无需预先建 .wemd
    await this.adapter.writeFile(
      WORKSPACE_THEME_PATH,
      serializeWorkspaceThemeFile(data),
    );
  }
}

/**
 * 整文件重写无法合并，连续保存必须串行，保证最后一次写入生效
 */
const withSerialWrites = (
  backend: WorkspaceThemeBackend,
): WorkspaceThemeBackend => {
  let queue: Promise<unknown> = Promise.resolve();
  return {
    read: () => backend.read(),
    write: (data) => {
      const next = queue.then(
        () => backend.write(data),
        () => backend.write(data),
      );
      queue = next.catch(() => undefined);
      return next;
    },
  };
};

interface BackendOptions {
  storageType?: string;
  storageReady?: boolean;
  adapter?: StorageAdapter | null;
  workspacePath?: string | null;
}

/**
 * 无工作区文件夹能力时返回 null，调用方回落到 localStorage 镜像
 */
export const createWorkspaceThemeBackend = (
  options: BackendOptions,
): WorkspaceThemeBackend | null => {
  const desktop = getDesktop();
  if (desktop) {
    if (
      !options.workspacePath ||
      typeof desktop.fs?.readThemes !== "function"
    ) {
      return null;
    }
    return withSerialWrites(new DesktopWorkspaceThemeBackend(desktop.fs));
  }

  if (
    options.storageType === "filesystem" &&
    options.storageReady &&
    options.adapter
  ) {
    return withSerialWrites(new AdapterWorkspaceThemeBackend(options.adapter));
  }

  return null;
};
