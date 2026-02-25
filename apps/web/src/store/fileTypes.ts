export interface FileItem {
  name: string;
  path: string;
  createdAt: Date;
  updatedAt: Date;
  size: number;
  title?: string;
  themeName?: string;
  isDirectory?: false; // 标识为文件
}

export interface FolderItem {
  name: string;
  path: string;
  createdAt: Date;
  updatedAt: Date;
  isDirectory: true; // 标识为文件夹
  children: TreeItem[];
}

export type TreeItem = FileItem | FolderItem;

export interface FileStoreState {
  workspacePath: string | null;
  files: TreeItem[]; // 支持树形结构
  currentFile: FileItem | null;
  isLoading: boolean;
  isSaving: boolean;

  // 状态同步字段
  lastSavedContent: string;
  lastSavedAt: Date | null; // 最后保存时间
  isDirty: boolean; // 内容是否已修改但未保存
  isRestoring: boolean; // 是否正在切换文件/恢复内容

  // 操作方法
  setWorkspacePath: (path: string | null) => void;
  setFiles: (files: TreeItem[]) => void;
  setCurrentFile: (file: FileItem | null) => void;
  setLoading: (loading: boolean) => void;
  setSaving: (saving: boolean) => void;

  // 状态更新方法
  setLastSavedContent: (content: string) => void;
  setLastSavedAt: (time: Date | null) => void;
  setIsDirty: (dirty: boolean) => void;
  setIsRestoring: (restoring: boolean) => void;
}
