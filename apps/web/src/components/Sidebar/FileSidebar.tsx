import { useThemeStore } from "../../store/themeStore";
import {
  Search,
  Plus,
  FolderOpen,
  FolderPlus,
  MoreHorizontal,
  ChevronRight,
} from "lucide-react";
import { SidebarFooter } from "./SidebarFooter";
import {
  DeleteFileModal,
  DeleteFolderModal,
  RenameFolderModal,
  NewFolderModal,
  Tooltip,
} from "./SidebarModals";
import { ContextMenu } from "./ContextMenu";
import {
  useSidebarState,
  getBaseName,
  ROOT_DROP_TARGET,
  FILE_DRAG_TYPE,
  FOLDER_DRAG_TYPE,
} from "./useSidebarState";
import "./FileSidebar.css";

import type { FileItem, FolderItem, TreeItem } from "../../store/fileTypes";

export function FileSidebar() {
  const state = useSidebarState();
  const currentThemeName = useThemeStore((s) => s.themeName);

  const renderFileItem = (file: FileItem) => (
    <div
      key={file.path}
      className={`fs-item ${state.currentFile?.path === file.path ? "active" : ""} ${state.draggingPath === file.path ? "dragging" : ""}`}
      onClick={() => state.handleFileClick(file)}
      onContextMenu={(e) => state.handleContextMenu(e, file)}
      draggable={state.isDragEnabled && state.renamingPath !== file.path}
      onDragStart={(e) => {
        if (!state.isDragEnabled) return;
        e.dataTransfer.setData(FILE_DRAG_TYPE, file.path);
        e.dataTransfer.setData("text/plain", file.path);
        e.dataTransfer.effectAllowed = "move";
        state.setDraggingPath(file.path);
      }}
      onDragEnd={() => {
        state.setDraggingPath(null);
        state.setDraggingFolderPath(null);
        state.setDragOverTarget(null);
      }}
    >
      <div className="fs-item-main">
        <div className="fs-title-block">
          {state.renamingPath === file.path ? (
            <div className="fs-rename" onClick={(e) => e.stopPropagation()}>
              <input
                value={state.renameValue}
                onChange={(e) => state.setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") state.submitRename();
                  if (e.key === "Escape") state.setRenamingPath(null);
                }}
                autoFocus
              />
              <button onClick={() => state.submitRename()}>确认</button>
              <button onClick={() => state.setRenamingPath(null)}>取消</button>
            </div>
          ) : (
            <>
              <span
                className="fs-title"
                title={file.title || file.name.replace(/\.md$/, "")}
              >
                {file.title || file.name.replace(/\.md$/, "")}
              </span>
              <div className="fs-meta-row">
                <span className="fs-time">
                  {state.formatTime(new Date(file.updatedAt))}
                </span>
                <span className="fs-meta-separator">·</span>
                <span className="fs-theme-info">
                  {state.currentFile?.path === file.path
                    ? currentThemeName
                    : file.themeName || "默认主题"}
                </span>
              </div>
            </>
          )}
        </div>
        <button
          className="fs-action-trigger"
          onClick={(e) => {
            e.stopPropagation();
            state.handleContextMenu(e, file);
          }}
        >
          <MoreHorizontal size={16} />
        </button>
      </div>
    </div>
  );

  const renderFolderItem = (folder: FolderItem) => {
    const isCollapsed = state.collapsedFolders.has(folder.path);
    const isActive = state.activeFolder === folder.path;
    return (
      <div key={folder.path} className="fs-folder-wrapper">
        <div
          className={`fs-folder ${isCollapsed ? "collapsed" : ""} ${isActive ? "active" : ""} ${state.dragOverTarget === folder.path ? "drop-target" : ""} ${state.draggingFolderPath === folder.path ? "dragging" : ""}`}
          onClick={() => state.toggleFolder(folder.path)}
          onContextMenu={(e) => state.handleFolderContextMenu(e, folder)}
          draggable={state.isDragEnabled}
          onDragStart={(e) => {
            if (!state.isDragEnabled) return;
            e.dataTransfer.setData(FOLDER_DRAG_TYPE, folder.path);
            e.dataTransfer.effectAllowed = "move";
            state.setDraggingFolderPath(folder.path);
          }}
          onDragEnd={() => {
            state.setDraggingFolderPath(null);
            state.setDraggingPath(null);
            state.setDragOverTarget(null);
          }}
          onDragOver={(e) => {
            if (!state.isDragEnabled) return;
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = "move";
            state.setDragOverTarget(folder.path);
          }}
          onDrop={(e) => state.handleDropToFolder(e, folder.path)}
          onDragLeave={(e) => state.handleDragLeave(e, folder.path)}
        >
          <ChevronRight
            size={14}
            className={`fs-folder-icon ${isCollapsed ? "" : "expanded"}`}
          />
          <FolderOpen size={14} className="fs-folder-type-icon" />
          <span className="fs-folder-name">{folder.name}</span>
          <span className="fs-folder-count">{folder.children.length}</span>
        </div>
        {!isCollapsed && (
          <div className="fs-folder-children">
            {folder.children.map((child) =>
              child.isDirectory
                ? renderFolderItem(child as FolderItem)
                : renderFileItem(child as FileItem),
            )}
          </div>
        )}
      </div>
    );
  };

  const renderTreeItems = (items: TreeItem[]) => {
    return items.map((item) =>
      item.isDirectory
        ? renderFolderItem(item as FolderItem)
        : renderFileItem(item as FileItem),
    );
  };

  return (
    <aside className="file-sidebar">
      <div className="fs-header">
        <div
          className="fs-workspace-info"
          onClick={state.selectWorkspace}
          title={state.workspacePath || "选择工作区"}
        >
          <FolderOpen size={14} />
          <span>
            {state.workspacePath
              ? getBaseName(state.workspacePath)
              : "选择工作区"}
          </span>
        </div>
        <div className="fs-actions">
          <button
            className="fs-btn-secondary fs-btn-icon-only"
            onClick={() => state.setShowNewFolderModal(true)}
            data-tooltip="新建文件夹"
            onMouseEnter={(e) => state.showTooltip(e, "新建文件夹")}
            onMouseLeave={state.hideTooltip}
            onFocus={(e) => state.showTooltip(e, "新建文件夹")}
            onBlur={state.hideTooltip}
          >
            <FolderPlus size={16} />
          </button>
          <button
            className="fs-btn-secondary fs-btn-icon-only"
            onClick={() => state.createFile(state.activeFolder || undefined)}
            data-tooltip={
              state.activeFolder
                ? `在 ${getBaseName(state.activeFolder)} 中新建`
                : "新建文章"
            }
            onMouseEnter={(e) =>
              state.showTooltip(
                e,
                state.activeFolder
                  ? `在 ${getBaseName(state.activeFolder)} 中新建`
                  : "新建文章",
              )
            }
            onMouseLeave={state.hideTooltip}
            onFocus={(e) =>
              state.showTooltip(
                e,
                state.activeFolder
                  ? `在 ${getBaseName(state.activeFolder)} 中新建`
                  : "新建文章",
              )
            }
            onBlur={state.hideTooltip}
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      <div className="fs-search">
        <div className="fs-search-wrapper">
          <Search size={14} className="fs-search-icon" />
          <input
            type="text"
            placeholder="搜索文件..."
            value={state.filter}
            onChange={(e) => state.setFilter(e.target.value)}
          />
        </div>
      </div>

      <div className="fs-body">
        <div
          className={`fs-list ${state.dragOverTarget === ROOT_DROP_TARGET ? "drop-target" : ""}`}
          onContextMenu={(e) => {
            if (e.target === e.currentTarget) state.handleEmptyContextMenu(e);
          }}
          onDragOver={(e) => {
            if (!state.isDragEnabled) return;
            if (e.target !== e.currentTarget) return;
            e.preventDefault();
            state.setDragOverTarget(ROOT_DROP_TARGET);
          }}
          onDrop={state.handleDropToRoot}
          onDragLeave={(e) => state.handleDragLeave(e, ROOT_DROP_TARGET)}
        >
          {!state.filter && (
            <div
              className={`fs-folder ${state.activeFolder === null ? "active" : ""} ${state.dragOverTarget === ROOT_DROP_TARGET ? "drop-target" : ""}`}
              onClick={() => state.setActiveFolder(null)}
              onDragOver={(e) => {
                if (!state.isDragEnabled) return;
                e.preventDefault();
                e.stopPropagation();
                state.setDragOverTarget(ROOT_DROP_TARGET);
              }}
              onDrop={(e) => state.handleDropToFolder(e, "")}
              onDragLeave={(e) => state.handleDragLeave(e, ROOT_DROP_TARGET)}
            >
              <FolderOpen size={14} className="fs-folder-type-icon" />
              <span className="fs-folder-name">
                {state.workspacePath
                  ? getBaseName(state.workspacePath)
                  : "根目录"}
              </span>
            </div>
          )}
          {state.filter
            ? (state.filteredItems as FileItem[]).map((file) =>
                renderFileItem(file),
              )
            : renderTreeItems(state.files)}
          {state.filteredItems.length === 0 && (
            <div className="fs-empty">暂无文件</div>
          )}
        </div>
      </div>

      <SidebarFooter />

      {state.menuOpen && (
        <ContextMenu
          position={state.menuPos}
          menuTarget={state.menuTarget}
          menuTargetFolder={state.menuTargetFolder}
          showMoveMenu={state.showMoveMenu}
          allFolders={state.allFolders}
          folderMoveTargets={
            state.menuTargetFolder
              ? state.getFolderMoveTargets(state.menuTargetFolder)
              : []
          }
          onClose={state.closeMenu}
          onCopyTitle={() =>
            state.menuTarget && state.copyTitle(state.menuTarget)
          }
          onStartRename={() =>
            state.menuTarget && state.startRename(state.menuTarget)
          }
          onToggleMoveMenu={() => state.setShowMoveMenu(!state.showMoveMenu)}
          onMoveToFolder={state.handleMoveToFolder}
          onMoveFolder={state.handleMoveFolder}
          onDeleteFile={() => {
            if (state.menuTarget) {
              state.setDeleteTarget(state.menuTarget);
              state.closeMenu();
            }
          }}
          onDeleteFolder={() => {
            if (state.menuTargetFolder) {
              state.prepareDeleteFolder(state.menuTargetFolder);
              state.closeMenu();
            }
          }}
          onStartRenameFolder={() => {
            if (state.menuTargetFolder) {
              state.setRenameFolderTarget(state.menuTargetFolder);
              state.setRenameFolderValue(state.menuTargetFolder.name);
              state.setShowRenameFolderModal(true);
              state.closeMenu();
            }
          }}
          onNewFolder={() => {
            state.setShowNewFolderModal(true);
            state.closeMenu();
          }}
        />
      )}

      {state.deleteTarget && (
        <DeleteFileModal
          target={state.deleteTarget}
          deleting={state.deleting}
          onConfirm={async () => {
            state.setDeleting(true);
            try {
              await state.deleteFile(state.deleteTarget!);
            } finally {
              state.setDeleting(false);
              state.setDeleteTarget(null);
            }
          }}
          onCancel={() => state.setDeleteTarget(null)}
        />
      )}

      {state.deleteFolderTarget && (
        <DeleteFolderModal
          target={state.deleteFolderTarget}
          extraItems={state.deleteFolderExtras}
          deleting={state.deleting}
          onConfirm={async () => {
            state.setDeleting(true);
            try {
              await state.deleteFolder(state.deleteFolderTarget!.path, {
                recursive:
                  state.deleteFolderTarget!.children.length > 0 ||
                  state.deleteFolderExtras.length > 0,
              });
            } finally {
              state.setDeleting(false);
              state.setDeleteFolderTarget(null);
              state.setDeleteFolderExtras([]);
            }
          }}
          onCancel={() => {
            state.setDeleteFolderTarget(null);
            state.setDeleteFolderExtras([]);
          }}
        />
      )}

      {state.showRenameFolderModal && (
        <RenameFolderModal
          value={state.renameFolderValue}
          onChange={state.setRenameFolderValue}
          onConfirm={state.handleRenameFolder}
          onCancel={state.closeRenameFolderModal}
        />
      )}

      {state.showNewFolderModal && (
        <NewFolderModal
          value={state.newFolderName}
          onChange={state.setNewFolderName}
          onConfirm={state.handleCreateFolder}
          onCancel={() => state.setShowNewFolderModal(false)}
        />
      )}

      {state.tooltip && (
        <Tooltip
          text={state.tooltip.text}
          x={state.tooltip.x}
          y={state.tooltip.y}
        />
      )}
    </aside>
  );
}
