/**
 * 平台适配器 - 统一桌面端/浏览器环境检测和专有行为封装
 * 唯一读取 window.wemdDesktop 的地方
 */
import type { DesktopBridge } from "../types/desktop";

// 基础环境检测（避免 SSR 环境报错）
const hasWindow = () => typeof window !== "undefined";

/** 桌面桥（Electron preload 或 Tauri bridge 注入），浏览器环境为 undefined */
export const getDesktop = (): DesktopBridge | undefined =>
  hasWindow() ? window.wemdDesktop : undefined;

/**
 * 平台检测状态
 */
export const platform = {
  /** 是否运行在桌面端 */
  get isDesktop(): boolean {
    return !!getDesktop();
  },

  /** 是否运行在 Web 浏览器环境 */
  get isWeb(): boolean {
    return hasWindow() && !getDesktop();
  },

  /** 是否为 macOS 平台 */
  get isMac(): boolean {
    return getDesktop()?.platform === "darwin";
  },

  /** 是否为 Windows 平台 */
  get isWindows(): boolean {
    return getDesktop()?.platform === "win32";
  },

  /** 原始平台字符串 */
  get name(): string | undefined {
    return getDesktop()?.platform;
  },
};

/**
 * 平台专有行为接口
 * 封装需要根据平台做不同处理的逻辑
 */
export const platformActions = {
  /**
   * 是否需要持久化历史快照
   * Web 环境需要持久化到 IndexedDB，桌面端文件直接保存
   */
  shouldPersistHistory: (): boolean => !platform.isDesktop,

  /**
   * 是否显示存储模式选择器
   * 仅 Web 环境需要（桌面端自带文件系统）
   */
  showStorageModeSelector: (): boolean => !platform.isDesktop,
};
