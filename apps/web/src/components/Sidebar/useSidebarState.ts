import type { SyntheticEvent } from "react";
import { useState, useMemo, useCallback } from "react";
import { useFileSystem } from "../../hooks/useFileSystem";
import toast from "react-hot-toast";
import type { FileItem, FolderItem, TreeItem } from "../../store/fileTypes";

const COLLAPSED_KEY = "wemd-folder-collapsed";
const ROOT_DROP_TARGET = "__root__";
const FILE_DRAG_TYPE = "application/x-wemd-file";
const FOLDER_DRAG_TYPE = "application/x-wemd-folder";

function getCollapsedState(): Set<string> {
  try {
    const saved = localStorage.getItem(COLLAPSED_KEY);
    return saved ? new Set(JSON.parse(saved)) : new Set();
  } catch {
    return new Set();
  }
}

function saveCollapsedState(collapsed: Set<string>) {
  localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...collapsed]));
}

export function getBaseName(rawPath: string | null): string {
  if (!rawPath) return "";
  const last = Math.max(rawPath.lastIndexOf("/"), rawPath.lastIndexOf("\\"));
  return last >= 0 ? rawPath.slice(last + 1) : rawPath;
}

export { ROOT_DROP_TARGET, FILE_DRAG_TYPE, FOLDER_DRAG_TYPE };

export function useSidebarState() {
  const {
    files,
    currentFile,
    openFile,
    createFile,
    renameFile,
    deleteFile,
    selectWorkspace,
    workspacePath,
    createFolder,
    moveToFolder,
    renameFolder,
    moveFolder,
    deleteFolder,
    inspectFolder,
    flattenFiles,
  } = useFileSystem();

  const [filter, setFilter] = useState("");
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [collapsedFolders, setCollapsedFolders] =
    useState<Set<string>>(getCollapsedState);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [menuTarget, setMenuTarget] = useState<FileItem | null>(null);
  const [menuTargetFolder, setMenuTargetFolder] = useState<FolderItem | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<FileItem | null>(null);
  const [deleteFolderTarget, setDeleteFolderTarget] =
    useState<FolderItem | null>(null);
  const [deleteFolderExtras, setDeleteFolderExtras] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const [draggingPath, setDraggingPath] = useState<string | null>(null);
  const [draggingFolderPath, setDraggingFolderPath] = useState<string | null>(
    null,
  );
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);
  const [renameFolderTarget, setRenameFolderTarget] =
    useState<FolderItem | null>(null);
  const [renameFolderValue, setRenameFolderValue] = useState("");
  const [showRenameFolderModal, setShowRenameFolderModal] = useState(false);

  const isDragEnabled = !filter;

  const allFolders = useMemo(() => {
    const folders: { name: string; path: string }[] = [];
    const collectFolders = (items: TreeItem[], prefix = "") => {
      for (const item of items) {
        if (item.isDirectory) {
          const fullName = prefix ? `${prefix}/${item.name}` : item.name;
          folders.push({ name: fullName, path: item.path });
          collectFolders(item.children, fullName);
        }
      }
    };
    collectFolders(files);
    return folders;
  }, [files]);

  const filteredItems = useMemo(() => {
    if (!filter) return files;
    const flatFiles = flattenFiles(files);
    return flatFiles.filter((f) =>
      f.name.toLowerCase().includes(filter.toLowerCase()),
    );
  }, [files, filter, flattenFiles]);

  const toggleFolder = useCallback((folderPath: string) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
        setActiveFolder(folderPath);
      } else {
        next.add(folderPath);
        setActiveFolder((current) => (current === folderPath ? null : current));
      }
      saveCollapsedState(next);
      return next;
    });
  }, []);

  const normalizePath = useCallback(
    (value: string) => value.replace(/\\/g, "/"),
    [],
  );

  const updateFolderPathState = useCallback(
    (oldPath: string, newPath: string) => {
      const normalizedOld = normalizePath(oldPath);
      const normalizedNew = normalizePath(newPath);

      setActiveFolder((current) => {
        if (!current) return current;
        const normalizedCurrent = normalizePath(current);
        if (
          normalizedCurrent === normalizedOld ||
          normalizedCurrent.startsWith(`${normalizedOld}/`)
        ) {
          const suffix = normalizedCurrent.slice(normalizedOld.length);
          const updatedNormalized = normalizedNew + suffix;
          return current.includes("\\")
            ? updatedNormalized.replace(/\//g, "\\")
            : updatedNormalized;
        }
        return current;
      });

      setCollapsedFolders((prev) => {
        const next = new Set<string>();
        for (const entry of prev) {
          const normalizedEntry = normalizePath(entry);
          if (
            normalizedEntry === normalizedOld ||
            normalizedEntry.startsWith(`${normalizedOld}/`)
          ) {
            const suffix = normalizedEntry.slice(normalizedOld.length);
            const updatedNormalized = normalizedNew + suffix;
            next.add(
              entry.includes("\\")
                ? updatedNormalized.replace(/\//g, "\\")
                : updatedNormalized,
            );
          } else {
            next.add(entry);
          }
        }
        saveCollapsedState(next);
        return next;
      });
    },
    [normalizePath],
  );

  const getFolderMoveTargets = useCallback(
    (folder: FolderItem) => {
      const normalizedFolder = normalizePath(folder.path);
      return allFolders.filter((item) => {
        if (item.path === folder.path) return false;
        const normalizedTarget = normalizePath(item.path);
        return !normalizedTarget.startsWith(`${normalizedFolder}/`);
      });
    },
    [allFolders, normalizePath],
  );

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    setMenuTarget(null);
    setMenuTargetFolder(null);
    setShowMoveMenu(false);
  }, []);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, file: FileItem) => {
      e.preventDefault();
      e.stopPropagation();
      setMenuTarget(file);
      setMenuTargetFolder(null);
      setMenuPos({ x: e.clientX, y: e.clientY });
      setMenuOpen(true);
      setShowMoveMenu(false);
    },
    [],
  );

  const handleFolderContextMenu = useCallback(
    (e: React.MouseEvent, folder: FolderItem) => {
      e.preventDefault();
      e.stopPropagation();
      setMenuTargetFolder(folder);
      setMenuTarget(null);
      setMenuPos({ x: e.clientX, y: e.clientY });
      setMenuOpen(true);
      setShowMoveMenu(false);
    },
    [],
  );

  const handleEmptyContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setMenuTarget(null);
    setMenuTargetFolder(null);
    setMenuPos({ x: e.clientX, y: e.clientY });
    setMenuOpen(true);
    setShowMoveMenu(false);
  }, []);

  const startRename = useCallback(
    (file: FileItem) => {
      setRenamingPath(file.path);
      setRenameValue(file.name.replace(".md", ""));
      closeMenu();
    },
    [closeMenu],
  );

  const copyTitle = useCallback(
    async (file: FileItem) => {
      try {
        const title = file.name.replace(".md", "");
        await navigator.clipboard.writeText(title);
        toast.success("标题已复制");
      } catch {
        toast.error("复制失败");
      }
      closeMenu();
    },
    [closeMenu],
  );

  const submitRename = useCallback(async () => {
    if (renamingPath && renameValue) {
      const flatFiles = flattenFiles(files);
      const file = flatFiles.find((f) => f.path === renamingPath);
      if (file) {
        await renameFile(file, renameValue);
      }
    }
    setRenamingPath(null);
  }, [renamingPath, renameValue, files, flattenFiles, renameFile]);

  const handleCreateFolder = useCallback(async () => {
    if (!newFolderName.trim()) {
      toast.error("请输入文件夹名称");
      return;
    }
    await createFolder(newFolderName.trim(), activeFolder || undefined);
    setNewFolderName("");
    setShowNewFolderModal(false);
  }, [newFolderName, activeFolder, createFolder]);

  const handleMoveToFolder = useCallback(
    async (targetFolder: string) => {
      if (menuTarget) {
        await moveToFolder(menuTarget, targetFolder);
      }
      closeMenu();
    },
    [menuTarget, moveToFolder, closeMenu],
  );

  const handleMoveFolder = useCallback(
    async (targetFolder: string) => {
      if (!menuTargetFolder) return;
      const res = await moveFolder(menuTargetFolder, targetFolder);
      if (res.success && res.newPath) {
        updateFolderPathState(menuTargetFolder.path, res.newPath);
      }
      closeMenu();
    },
    [menuTargetFolder, moveFolder, updateFolderPathState, closeMenu],
  );

  const handleRenameFolder = useCallback(async () => {
    if (!renameFolderTarget) return;
    const nextName = renameFolderValue.trim();
    if (!nextName) {
      toast.error("请输入文件夹名称");
      return;
    }
    const res = await renameFolder(renameFolderTarget, nextName);
    if (res.success && res.newPath) {
      updateFolderPathState(renameFolderTarget.path, res.newPath);
    }
    setShowRenameFolderModal(false);
    setRenameFolderTarget(null);
    setRenameFolderValue("");
  }, [
    renameFolderTarget,
    renameFolderValue,
    renameFolder,
    updateFolderPathState,
  ]);

  const closeRenameFolderModal = useCallback(() => {
    setShowRenameFolderModal(false);
    setRenameFolderTarget(null);
    setRenameFolderValue("");
  }, []);

  const prepareDeleteFolder = useCallback(
    async (folder: FolderItem) => {
      setDeleteFolderTarget(folder);
      setDeleteFolderExtras([]);
      const extras = await inspectFolder(folder.path);
      setDeleteFolderExtras(extras);
    },
    [inspectFolder],
  );

  const showTooltipFn = useCallback((e: SyntheticEvent, text: string) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltip({ text, x: rect.left + rect.width / 2, y: rect.bottom + 8 });
  }, []);

  const hideTooltip = useCallback(() => setTooltip(null), []);

  const findFileByPath = useCallback(
    (path: string) => flattenFiles(files).find((item) => item.path === path),
    [files, flattenFiles],
  );

  const findFolderByPath = useCallback(
    (items: TreeItem[], target: string): FolderItem | null => {
      for (const item of items) {
        if (item.isDirectory) {
          if (item.path === target) return item;
          const found = findFolderByPath(item.children, target);
          if (found) return found;
        }
      }
      return null;
    },
    [],
  );

  const isDescendantPath = useCallback(
    (parentPath: string, childPath: string) => {
      const normalizedParent = normalizePath(parentPath);
      const normalizedChild = normalizePath(childPath);
      return (
        normalizedChild === normalizedParent ||
        normalizedChild.startsWith(`${normalizedParent}/`)
      );
    },
    [normalizePath],
  );

  const handleDropToFolder = useCallback(
    async (e: React.DragEvent, targetFolder: string) => {
      if (!isDragEnabled) return;
      e.preventDefault();
      e.stopPropagation();
      const draggedFolderPath = e.dataTransfer.getData(FOLDER_DRAG_TYPE);
      if (draggedFolderPath) {
        if (targetFolder && isDescendantPath(draggedFolderPath, targetFolder)) {
          setDragOverTarget(null);
          return;
        }
        const folder = findFolderByPath(files, draggedFolderPath);
        if (!folder) return;
        const res = await moveFolder(folder, targetFolder);
        if (res.success && res.newPath) {
          updateFolderPathState(folder.path, res.newPath);
        }
        setDragOverTarget(null);
        return;
      }
      const filePath =
        e.dataTransfer.getData(FILE_DRAG_TYPE) ||
        e.dataTransfer.getData("text/plain");
      if (!filePath) return;
      const file = findFileByPath(filePath);
      if (!file) return;
      await moveToFolder(file, targetFolder);
      setDragOverTarget(null);
    },
    [
      isDragEnabled,
      files,
      isDescendantPath,
      findFolderByPath,
      moveFolder,
      updateFolderPathState,
      findFileByPath,
      moveToFolder,
    ],
  );

  const handleDropToRoot = useCallback(
    async (e: React.DragEvent) => {
      if (!isDragEnabled) return;
      e.preventDefault();
      if (e.target !== e.currentTarget) return;
      const draggedFolderPath = e.dataTransfer.getData(FOLDER_DRAG_TYPE);
      if (draggedFolderPath) {
        const folder = findFolderByPath(files, draggedFolderPath);
        if (!folder) return;
        const res = await moveFolder(folder, "");
        if (res.success && res.newPath) {
          updateFolderPathState(folder.path, res.newPath);
        }
        setDragOverTarget(null);
        return;
      }
      const filePath =
        e.dataTransfer.getData(FILE_DRAG_TYPE) ||
        e.dataTransfer.getData("text/plain");
      if (!filePath) return;
      const file = findFileByPath(filePath);
      if (!file) return;
      await moveToFolder(file, "");
      setDragOverTarget(null);
    },
    [
      isDragEnabled,
      files,
      findFolderByPath,
      moveFolder,
      updateFolderPathState,
      findFileByPath,
      moveToFolder,
    ],
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent, targetKey: string) => {
      if (!isDragEnabled) return;
      const related = e.relatedTarget as Node | null;
      if (related && e.currentTarget.contains(related)) return;
      setDragOverTarget((current) => (current === targetKey ? null : current));
    },
    [isDragEnabled],
  );

  const handleFileClick = useCallback(
    (file: FileItem) => {
      openFile(file);
      const normalizedPath = file.path.replace(/\\/g, "/");
      const lastIndex = normalizedPath.lastIndexOf("/");
      let parentPath = null;
      if (lastIndex !== -1) {
        parentPath = file.path.substring(
          0,
          file.path.length - (normalizedPath.length - lastIndex),
        );
      }
      if (!parentPath) {
        setActiveFolder(null);
      } else if (workspacePath && parentPath === workspacePath) {
        setActiveFolder(null);
      } else {
        setActiveFolder(parentPath);
      }
      if (parentPath) {
        setCollapsedFolders((prev) => {
          const next = new Set(prev);
          let current = file.path;
          while (true) {
            const sepIndex = Math.max(
              current.lastIndexOf("/"),
              current.lastIndexOf("\\"),
            );
            if (sepIndex === -1) break;
            const parent = current.substring(0, sepIndex);
            if (workspacePath && parent === workspacePath) break;
            if (next.has(parent)) next.delete(parent);
            current = parent;
            if (!current) break;
          }
          saveCollapsedState(next);
          return next;
        });
      }
    },
    [openFile, workspacePath],
  );

  const formatTime = useCallback((date: Date) => {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const startOfDate = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    );
    const diff = startOfToday.getTime() - startOfDate.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days <= 0) {
      return date.toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    if (days < 7) {
      const rtf = new Intl.RelativeTimeFormat("zh", { numeric: "auto" });
      return rtf.format(-days, "day");
    }

    return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
  }, []);

  return {
    // Data from useFileSystem
    files,
    currentFile,
    createFile,
    deleteFile,
    deleteFolder,
    selectWorkspace,
    workspacePath,
    flattenFiles,

    // Computed values
    allFolders,
    filteredItems,
    isDragEnabled,

    // State
    filter,
    setFilter,
    renamingPath,
    setRenamingPath,
    renameValue,
    setRenameValue,
    collapsedFolders,
    menuOpen,
    menuPos,
    menuTarget,
    menuTargetFolder,
    deleteTarget,
    setDeleteTarget,
    deleteFolderTarget,
    setDeleteFolderTarget,
    deleteFolderExtras,
    setDeleteFolderExtras,
    deleting,
    setDeleting,
    showNewFolderModal,
    setShowNewFolderModal,
    newFolderName,
    setNewFolderName,
    activeFolder,
    setActiveFolder,
    showMoveMenu,
    setShowMoveMenu,
    draggingPath,
    setDraggingPath,
    draggingFolderPath,
    setDraggingFolderPath,
    dragOverTarget,
    setDragOverTarget,
    tooltip,
    renameFolderTarget,
    setRenameFolderTarget,
    renameFolderValue,
    setRenameFolderValue,
    showRenameFolderModal,
    setShowRenameFolderModal,

    // Handlers
    toggleFolder,
    getFolderMoveTargets,
    closeMenu,
    handleContextMenu,
    handleFolderContextMenu,
    handleEmptyContextMenu,
    startRename,
    copyTitle,
    submitRename,
    handleCreateFolder,
    handleMoveToFolder,
    handleMoveFolder,
    handleRenameFolder,
    closeRenameFolderModal,
    prepareDeleteFolder,
    showTooltip: showTooltipFn,
    hideTooltip,
    handleDropToFolder,
    handleDropToRoot,
    handleDragLeave,
    handleFileClick,
    formatTime,
  };
}
