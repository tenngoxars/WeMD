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
    // 由 Rust 发出请求，不受跨域限制；可访问的地址由 capabilities/default.json 限定
    net: {
      fetch: (...args) => window.__TAURI__.http.fetch(...args),
    },
    shell: {
      openExternal: (url) => invoke("open_external", { url }),
    },
    clipboard: {
      writeHTML: (payload) => invoke("clipboard_write_html", { html: payload?.html ?? "", text: payload?.text ?? "" }),
      writeText: (text) => invoke("clipboard_write_text", { text }),
    },
  };

  // 与 Electron 一致，不显示 WebView 自带的右键菜单（其中的「粘贴」在 Linux 上同样会走崩溃路径）
  document.addEventListener("contextmenu", (event) => event.preventDefault());

  if (platform !== "linux") return;

  // Linux 的 WebKitGTK 读剪贴板图片会崩溃（≥2.52）或读不到（<2.52）。
  // 拦下 Ctrl+V，由 Rust 读剪贴板，再交给页面现有的粘贴处理（编辑器图片上传、CodeMirror 文本粘贴）。
  const dispatchPaste = (target, data) => {
    const clipboardData = new DataTransfer();
    (data.files ?? []).forEach((file) => clipboardData.items.add(file));
    if (data.text != null) clipboardData.setData("text/plain", data.text);
    const event = new ClipboardEvent("paste", { clipboardData, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    return event.defaultPrevented;
  };

  const pasteText = (target, text) => {
    // 普通输入框：合成的 paste 事件不会插入文字，直接改值并发出 input 事件（React 受控组件靠它更新）
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      target.setRangeText(text, target.selectionStart ?? 0, target.selectionEnd ?? 0, "end");
      target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertFromPaste", data: text }));
      return;
    }
    if (!dispatchPaste(target, { text }) && target.isContentEditable) {
      document.execCommand("insertText", false, text);
    }
  };

  const IMAGE_TYPES = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", bmp: "image/bmp" };

  const pasteFromRust = async (target) => {
    // 截图、浏览器「复制图片」：剪贴板里是图片数据
    const image = new Uint8Array(await invoke("clipboard_read_image"));
    if (image.byteLength > 0) {
      dispatchPaste(target, { files: [new File([image], "image.png", { type: "image/png" })] });
      return;
    }
    // 文件管理器复制图片：剪贴板里只有文件路径，由 Rust 读取原文件
    const names = await invoke("clipboard_image_files");
    if (names.length > 0) {
      const files = await Promise.all(
        names.map(async (name, index) => {
          const bytes = await invoke("clipboard_read_image_file", { index });
          const type = IMAGE_TYPES[name.split(".").pop().toLowerCase()];
          return new File([new Uint8Array(bytes)], name, { type });
        }),
      );
      dispatchPaste(target, { files });
      return;
    }
    const text = await invoke("clipboard_read_text");
    if (text) pasteText(target, text);
  };

  document.addEventListener(
    "keydown",
    (event) => {
      const isPaste = (event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "v";
      if (!isPaste || event.defaultPrevented) return;
      // 阻止默认行为，WebKitGTK 就不会执行自带的粘贴命令去读剪贴板
      event.preventDefault();
      const target = document.activeElement ?? document.body;
      pasteFromRust(target).catch((error) => console.error("[WeMD] 粘贴失败", error));
    },
    true,
  );
})();
