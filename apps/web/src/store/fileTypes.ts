export interface FileItem {
    name: string;
    path: string;
    createdAt: Date;
    updatedAt: Date;
    size: number;
    themeName?: string;
}

export interface FileStoreState {
    workspacePath: string | null;
    files: FileItem[];
    currentFile: FileItem | null;
    isLoading: boolean;
    isSaving: boolean;

    // 状态同步字段
    lastSavedContent: string;
    isDirty: boolean; // 内容是否已修改但未保存
    isRestoring: boolean; // 是否正在切换文件/恢复内容

    // 操作方法
    setWorkspacePath: (path: string | null) => void;
    setFiles: (files: FileItem[]) => void;
    setCurrentFile: (file: FileItem | null) => void;
    setLoading: (loading: boolean) => void;
    setSaving: (saving: boolean) => void;

    // 状态更新方法
    setLastSavedContent: (content: string) => void;
    setIsDirty: (dirty: boolean) => void;
    setIsRestoring: (restoring: boolean) => void;
}
