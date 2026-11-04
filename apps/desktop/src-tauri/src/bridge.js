// Tauri 端的桌面桥实现：向前端注入 window.wemdDesktop，接口与 Electron preload 一致（类型见 apps/web/src/types/desktop.d.ts）。
(() => {
  const invoke = (cmd, args) => window.__TAURI__.core.invoke(cmd, args);
  const currentWindow = () => window.__TAURI__.window.getCurrentWindow();
  const ua = navigator.userAgent;
  const platform = /Mac/.test(ua) ? "darwin" : /Win/.test(ua) ? "win32" : "linux";

  // 事件频道，对应 Electron 的 ipcRenderer.on/removeListener：on 返回的句柄用于解绑
  const listeners = {};
  const on = (channel, callback) => {
    const handler = (data) => callback(data);
    (listeners[channel] ??= new Set()).add(handler);
    return handler;
  };
  const emit = (channel, data) => listeners[channel]?.forEach((handler) => handler(data));
  const FS_CHANNELS = ["file:refresh", "menu:new-file", "menu:save", "menu:switch-workspace"];
  const UPDATE_CHANNELS = ["update:available", "update:upToDate", "update:error"];
  // 文件监听（watcher.rs）与 macOS 菜单（menu.rs）由 Rust 发出
  FS_CHANNELS.forEach((channel) => window.__TAURI__.event.listen(channel, () => emit(channel)));

  // 检查更新，对齐 apps/electron/src/updater.ts；请求经 Rust 发出，地址在 capabilities/default.json 放行
  const RELEASES_URL = "https://github.com/tenngoxars/WeMD/releases";
  const LATEST_RELEASE_API = "https://api.github.com/repos/tenngoxars/WeMD/releases/latest";
  // 按 SemVer 比较（忽略 build 元数据）：核心三段相同时，无 prerelease 的更新；都有时逐个标识符比较
  const compareSemver = (a, b) => {
    const parse = (v) => {
      const [core, ...pre] = v.replace(/^v/, "").split("+")[0].split("-");
      return { core: core.split(".").map(Number), pre: pre.length ? pre.join("-").split(".") : [] };
    };
    const x = parse(a);
    const y = parse(b);
    for (let i = 0; i < 3; i++) {
      const d = (x.core[i] || 0) - (y.core[i] || 0);
      if (d) return Math.sign(d);
    }
    if (!x.pre.length || !y.pre.length) return Math.sign(y.pre.length - x.pre.length);
    for (let i = 0; i < Math.min(x.pre.length, y.pre.length); i++) {
      const p = x.pre[i];
      const q = y.pre[i];
      const pn = /^\d+$/.test(p);
      const qn = /^\d+$/.test(q);
      if (pn && qn && Number(p) !== Number(q)) return Number(p) > Number(q) ? 1 : -1;
      if (pn !== qn) return pn ? -1 : 1;
      if (!pn && p !== q) return p > q ? 1 : -1;
    }
    return Math.sign(x.pre.length - y.pre.length);
  };
  const isNewerVersion = (latest, current) => compareSemver(latest, current) > 0;
  // force：菜单「检查更新」触发，已是最新或失败时也要告诉用户
  const checkForUpdates = async (force) => {
    try {
      const response = await window.__TAURI__.http.fetch(LATEST_RELEASE_API, { headers: { "User-Agent": "WeMD-Tauri" } });
      if (!response.ok) return;
      const data = await response.json();
      const latestVersion = data.tag_name?.replace(/^v/, "");
      const currentVersion = await window.__TAURI__.app.getVersion();
      if (latestVersion && isNewerVersion(latestVersion, currentVersion)) {
        emit("update:available", { latestVersion, currentVersion, releaseUrl: RELEASES_URL, releaseNotes: data.body || "", force });
      } else if (force) {
        emit("update:upToDate", { currentVersion });
      }
    } catch (error) {
      console.error("[WeMD] 检查更新失败", error);
      if (force) emit("update:error");
    }
  };
  window.__TAURI__.event.listen("menu:check-update", () => checkForUpdates(true));
  // 与 Electron 一样启动 3 秒后自动检查一次；页面重新加载不重复检查
  if (!sessionStorage.getItem("wemd-update-checked")) {
    sessionStorage.setItem("wemd-update-checked", "1");
    setTimeout(() => checkForUpdates(false), 3000);
  }

  window.wemdDesktop = {
    platform,
    fs: {
      selectWorkspace: () => invoke("workspace_select"),
      setWorkspace: (dir) => invoke("workspace_set", { dir }),
      listFiles: (dir) => invoke("file_list", { dir: dir ?? null }),
      readFile: (filePath) => invoke("file_read", { filePath }),
      createFile: (payload) => invoke("file_create", { payload: payload ?? {} }),
      saveFile: (payload) => invoke("file_save", { payload }),
      renameFile: (payload) => invoke("file_rename", { payload: payload ?? {} }),
      deleteFile: (filePath) => invoke("file_delete", { filePath: filePath ?? "" }),
      revealInFinder: (filePath) => invoke("file_reveal", { filePath: filePath ?? "" }),
      createFolder: (folderPath) => invoke("folder_create", { folderPath: folderPath ?? "" }),
      moveFile: (payload) => invoke("folder_move", { payload: payload ?? {} }),
      inspectFolder: (folderPath) => invoke("folder_inspect", { folderPath: folderPath ?? "" }),
      deleteFolder: (payload) =>
        invoke("folder_delete", { payload: typeof payload === "string" ? { folderPath: payload } : (payload ?? {}) }),
      renameFolder: (payload) => invoke("folder_rename", { payload: payload ?? {} }),
      moveFolder: (payload) => invoke("folder_move_folder", { payload: payload ?? {} }),
      onRefresh: (callback) => on("file:refresh", callback),
      removeRefreshListener: (handler) => listeners["file:refresh"]?.delete(handler),
      onMenuNewFile: (callback) => on("menu:new-file", callback),
      onMenuSave: (callback) => on("menu:save", callback),
      onMenuSwitchWorkspace: (callback) => on("menu:switch-workspace", callback),
      readThemes: () => invoke("theme_read"),
      writeThemes: (content) => invoke("theme_write", { content }),
      removeAllListeners: () => FS_CHANNELS.forEach((channel) => listeners[channel]?.clear()),
    },
    window: {
      minimize: () => currentWindow().minimize(),
      maximize: () => currentWindow().toggleMaximize(),
      close: () => currentWindow().close(),
      isMaximized: () => currentWindow().isMaximized(),
    },
    update: {
      onUpdateAvailable: (callback) => on("update:available", callback),
      onUpToDate: (callback) => on("update:upToDate", callback),
      onUpdateError: (callback) => on("update:error", callback),
      removeUpdateListener: (handler) => UPDATE_CHANNELS.forEach((channel) => listeners[channel]?.delete(handler)),
      openReleases: () => invoke("open_external", { url: RELEASES_URL }),
      check: () => checkForUpdates(true),
      canInstall: () => invoke("updater_supported"),
      // 应用内更新：下载签名更新包（latest.json 由发版流水线生成）、安装后重启
      install: async (onProgress) => {
        const update = await window.__TAURI__.updater.check();
        if (!update) throw new Error("未找到可安装的更新包");
        let total;
        let downloaded = 0;
        await update.downloadAndInstall((event) => {
          if (event.event === "Started") total = event.data.contentLength;
          else if (event.event === "Progress") downloaded += event.data.chunkLength;
          else return;
          onProgress?.(downloaded, total);
        });
        await window.__TAURI__.process.relaunch();
      },
    },
    // 由 Rust 发出请求，不受跨域限制；可访问的地址由 capabilities/default.json 限定
    net: {
      fetch: (...args) => window.__TAURI__.http.fetch(...args),
    },
    // 跳过 v1.6.1 直接升级时提示一次迁移方法（migration.rs）
    migration: {
      takeHint: () => invoke("migration_take_hint"),
    },
    shell: {
      openExternal: (url) => invoke("open_external", { url }),
    },
    clipboard: {
      writeHTML: (payload) => invoke("clipboard_write_html", { html: payload?.html ?? "", text: payload?.text ?? "" }),
      writeText: (text) => invoke("clipboard_write_text", { text }),
    },
  };

  // Linux、Windows 没有菜单栏，新建、保存快捷键在这里转成菜单事件。
  // 与 Electron 一致，页面自己处理过（preventDefault）的按键不再触发菜单，例如 App.tsx 的 Ctrl+S
  if (platform !== "darwin") {
    const SHORTCUTS = { n: "menu:new-file", s: "menu:save" };
    window.addEventListener("keydown", (event) => {
      if (event.defaultPrevented || !event.ctrlKey || event.altKey || event.shiftKey || event.metaKey) return;
      const channel = SHORTCUTS[event.key.toLowerCase()];
      if (!channel) return;
      event.preventDefault();
      emit(channel);
    });
  }

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

  const pasteFromRust = async (target, textOnly) => {
    const pasteClipboardText = async () => {
      const text = await invoke("clipboard_read_text");
      if (text) pasteText(target, text);
    };
    // 输入框与 Shift+Ctrl+V 只粘贴文本
    if (textOnly) return pasteClipboardText();
    // 截图、浏览器「复制图片」：剪贴板里是图片数据
    const image = new Uint8Array(await invoke("clipboard_read_image"));
    if (image.byteLength > 0) {
      // 页面没处理图片（如目标不接收图片）时退回文本
      if (!dispatchPaste(target, { files: [new File([image], "image.png", { type: "image/png" })] })) await pasteClipboardText();
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
      if (!dispatchPaste(target, { files })) await pasteClipboardText();
      return;
    }
    await pasteClipboardText();
  };

  document.addEventListener(
    "keydown",
    (event) => {
      const isPaste = (event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "v";
      if (!isPaste || event.defaultPrevented) return;
      // 阻止默认行为，WebKitGTK 就不会执行自带的粘贴命令去读剪贴板
      event.preventDefault();
      const target = document.activeElement ?? document.body;
      const textOnly = event.shiftKey || target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
      pasteFromRust(target, textOnly).catch((error) => console.error("[WeMD] 粘贴失败", error));
    },
    true,
  );
})();
