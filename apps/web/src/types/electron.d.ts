interface ElectronAPI {
  isElectron: boolean;
  platform: string;
  fs: {
    selectWorkspace: () => Promise<{
      success: boolean;
      path?: string;
      canceled?: boolean;
    }>;
    setWorkspace: (
      dir: string,
    ) => Promise<{ success: boolean; path?: string; error?: string }>;
    listFiles: (
      dir?: string,
    ) => Promise<{ success: boolean; files?: unknown[]; error?: string }>;
    readFile: (
      filePath: string,
    ) => Promise<{ success: boolean; content?: string; error?: string }>;
    readImage: (filePath: string) => Promise<{
      success: boolean;
      data?: string;
      mime?: string;
      error?: string;
    }>;
    createFile: (payload: { filename?: string; content?: string }) => Promise<{
      success: boolean;
      filePath?: string;
      filename?: string;
      error?: string;
    }>;
    saveFile: (payload: {
      filePath: string;
      content: string;
    }) => Promise<{ success: boolean; error?: string }>;
    renameFile: (payload: {
      oldPath: string;
      newName: string;
    }) => Promise<{ success: boolean; filePath?: string; error?: string }>;
    deleteFile: (
      filePath: string,
    ) => Promise<{ success: boolean; error?: string }>;
    revealInFinder: (filePath: string) => Promise<void>;
    createFolder: (folderName: string) => Promise<{
      success: boolean;
      path?: string;
      name?: string;
      error?: string;
    }>;
    moveFile: (payload: {
      filePath: string;
      targetFolder: string;
    }) => Promise<{ success: boolean; newPath?: string; error?: string }>;
    inspectFolder: (
      folderPath: string,
    ) => Promise<{ success: boolean; entries?: string[]; error?: string }>;
    deleteFolder: (
      payload: string | { folderPath: string; recursive?: boolean },
    ) => Promise<{ success: boolean; error?: string }>;
    renameFolder: (payload: {
      folderPath: string;
      newName: string;
    }) => Promise<{ success: boolean; newPath?: string; error?: string }>;
    moveFolder: (payload: {
      folderPath: string;
      targetFolder: string;
    }) => Promise<{ success: boolean; newPath?: string; error?: string }>;
    readThemes: () => Promise<{
      success: boolean;
      content?: string | null;
      error?: string;
    }>;
    writeThemes: (
      content: string,
    ) => Promise<{ success: boolean; error?: string }>;
    onRefresh: (callback: () => void) => unknown;
    removeRefreshListener: (handler: unknown) => void;
    onMenuNewFile: (callback: () => void) => unknown;
    onMenuSave: (callback: () => void) => unknown;
    onMenuSwitchWorkspace: (callback: () => void) => unknown;
    removeAllListeners: () => void;
  };
  window?: {
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    close: () => Promise<void>;
    isMaximized: () => Promise<boolean>;
  };
  shell?: {
    openExternal: (url: string) => Promise<void>;
  };
  clipboard?: {
    writeHTML: (payload: {
      html: string;
      text: string;
    }) => Promise<{ success: boolean; error?: string }>;
    writeText: (text: string) => Promise<{ success: boolean; error?: string }>;
  };
}

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}

export {};
