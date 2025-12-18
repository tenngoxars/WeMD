import { create } from 'zustand';
import type { FileStoreState } from './fileTypes';

export const useFileStore = create<FileStoreState>((set) => ({
    workspacePath: null,
    files: [],
    currentFile: null,
    isLoading: false,
    isSaving: false,

    // 状态同步字段初始化
    lastSavedContent: '',
    isDirty: false,
    isRestoring: false,

    setWorkspacePath: (path) => set({ workspacePath: path }),
    setFiles: (files) => set({ files }),
    setCurrentFile: (file) => set({ currentFile: file }),
    setLoading: (loading) => set({ isLoading: loading }),
    setSaving: (saving) => set({ isSaving: saving }),

    setLastSavedContent: (content) => set({ lastSavedContent: content }),
    setIsDirty: (dirty) => set({ isDirty: dirty }),
    setIsRestoring: (restoring) => set({ isRestoring: restoring }),
}));
