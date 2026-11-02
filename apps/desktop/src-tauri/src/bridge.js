// 原型阶段：在 Tauri 里提供与 Electron preload 同形的 window.electron，前端无需改动即可跑主流程。
// 阶段 2 会收敛为前端的平台适配层，届时删除本文件。
(() => {
  const invoke = (cmd, args) => window.__TAURI__.core.invoke(cmd, args);
  const currentWindow = () => window.__TAURI__.window.getCurrentWindow();
  const ua = navigator.userAgent;
  const platform = /Mac/.test(ua) ? "darwin" : /Win/.test(ua) ? "win32" : "linux";
  // 原型未覆盖的能力：返回失败结果，前端按现有错误分支提示
  const unsupported = () => Promise.resolve({ success: false, error: "原型暂不支持" });
  // 菜单、文件监听、更新事件在原型里没有来源，返回占位句柄供前端解绑
  const noEvents = () => () => {};

  window.electron = {
    isElectron: true,
    platform,
    fs: {
      selectWorkspace: () => invoke("workspace_select"),
      setWorkspace: (dir) => invoke("workspace_set", { dir }),
      listFiles: (dir) => invoke("file_list", { dir: dir ?? null }),
      readFile: (filePath) => invoke("file_read", { filePath }),
      createFile: (payload) => invoke("file_create", { payload: payload ?? {} }),
      saveFile: (payload) => invoke("file_save", { payload }),
      renameFile: unsupported,
      deleteFile: unsupported,
      revealInFinder: unsupported,
      createFolder: unsupported,
      moveFile: unsupported,
      inspectFolder: unsupported,
      deleteFolder: unsupported,
      renameFolder: unsupported,
      moveFolder: unsupported,
      onRefresh: noEvents,
      removeRefreshListener: () => {},
      onMenuNewFile: noEvents,
      onMenuSave: noEvents,
      onMenuSwitchWorkspace: noEvents,
      readThemes: () => invoke("theme_read"),
      writeThemes: (content) => invoke("theme_write", { content }),
      removeAllListeners: () => {},
    },
    window: {
      minimize: () => currentWindow().minimize(),
      maximize: () => currentWindow().toggleMaximize(),
      close: () => currentWindow().close(),
      isMaximized: () => currentWindow().isMaximized(),
    },
    update: {
      onUpdateAvailable: noEvents,
      onUpToDate: noEvents,
      onUpdateError: noEvents,
      removeUpdateListener: () => {},
      openReleases: () => invoke("open_external", { url: "https://github.com/tenngoxars/WeMD/releases" }),
    },
    shell: {
      openExternal: (url) => invoke("open_external", { url }),
    },
    clipboard: {
      writeHTML: (payload) => invoke("clipboard_write_html", { html: payload?.html ?? "", text: payload?.text ?? "" }),
      writeText: (text) => invoke("clipboard_write_text", { text }),
    },
  };
})();
