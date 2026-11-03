import { useEffect } from "react";
import { getDesktop } from "../lib/platformAdapter";

interface WindowControlsOverlay {
  visible: boolean;
  getTitlebarAreaRect: () => DOMRect;
  addEventListener: (type: "geometrychange", listener: () => void) => void;
  removeEventListener: (type: "geometrychange", listener: () => void) => void;
}

export function useWindowControls() {
  const desktop = getDesktop();
  const isDesktop = !!desktop;
  const platform = desktop?.platform;
  const isWindows = platform === "win32";
  const isMac = platform === "darwin";

  useEffect(() => {
    if (!isDesktop || isWindows) {
      document.documentElement.style.removeProperty("--titlebar-right-inset");
      document.documentElement.style.removeProperty("--titlebar-left-inset");
      return;
    }

    const nav = navigator as Navigator & {
      windowControlsOverlay?: WindowControlsOverlay;
    };

    const controlsOverlay = nav.windowControlsOverlay;

    if (!controlsOverlay?.getTitlebarAreaRect) {
      document.documentElement.style.removeProperty("--titlebar-right-inset");
      document.documentElement.style.removeProperty("--titlebar-left-inset");
      return;
    }

    const updateInset = () => {
      if (controlsOverlay.visible === false) {
        document.documentElement.style.setProperty(
          "--titlebar-right-inset",
          "0px",
        );
        document.documentElement.style.setProperty(
          "--titlebar-left-inset",
          "0px",
        );
        return;
      }
      const rect = controlsOverlay.getTitlebarAreaRect();
      const leftInset = Math.max(0, Math.round(rect.x));
      const rightInset = Math.max(
        0,
        Math.round(window.innerWidth - (rect.x + rect.width)),
      );
      document.documentElement.style.setProperty(
        "--titlebar-left-inset",
        `${leftInset}px`,
      );
      document.documentElement.style.setProperty(
        "--titlebar-right-inset",
        `${rightInset}px`,
      );
    };

    updateInset();
    const handleResize = () => updateInset();
    window.addEventListener("resize", handleResize);
    controlsOverlay.addEventListener?.("geometrychange", updateInset);

    return () => {
      window.removeEventListener("resize", handleResize);
      controlsOverlay.removeEventListener?.("geometrychange", updateInset);
      document.documentElement.style.removeProperty("--titlebar-right-inset");
      document.documentElement.style.removeProperty("--titlebar-left-inset");
    };
  }, [isDesktop, isWindows]);

  return {
    isDesktop,
    isWindows,
    isMac,
    platform,
    // 非桌面端时为 undefined
    minimize: desktop?.window?.minimize,
    maximize: desktop?.window?.maximize,
    close: desktop?.window?.close,
  };
}
