import { useState } from "react";
import toast from "react-hot-toast";
import { uploadLocalImagesInMarkdown } from "../services/image/localImageUploadService";
import { useEditorStore } from "../store/editorStore";
import { useFileStore } from "../store/fileStore";
import { useThemeStore } from "../store/themeStore";
import { dirnameOf } from "../utils/localImageResolver";
import {
  applyMarkdownFileMeta,
  stripMarkdownExtension,
} from "../utils/markdownFileMeta";

/**
 * 一键上传当前文档中的本地图片到图床，并把 markdown 源文中的本地路径替换为在线链接。
 * 仅 Electron 工作区模式（打开了本地文件）下可用。
 */
export function useLocalImageUpload() {
  const [uploadingLocalImages, setUploadingLocalImages] = useState(false);
  const currentFilePath = useFileStore((state) => state.currentFile?.path);
  const isElectronEnv = typeof window !== "undefined" && !!window.electron;
  const canUploadLocalImages = isElectronEnv && !!currentFilePath;

  const uploadLocalImages = async () => {
    const electronApi = window.electron;
    const file = useFileStore.getState().currentFile;
    if (!electronApi || !file || uploadingLocalImages) return;

    const { markdown, setMarkdown } = useEditorStore.getState();
    const baseDir = dirnameOf(file.path);

    setUploadingLocalImages(true);
    const loadingToastId = toast.loading("正在上传本地图片...");
    try {
      const result = await uploadLocalImagesInMarkdown(markdown, baseDir);
      if (result.uploaded === 0 && result.failed.length === 0) {
        toast("未发现本地图片", { icon: "ℹ️" });
        return;
      }

      if (result.uploaded > 0) {
        setMarkdown(result.markdown);

        // 参照 useActiveFilePersistence 的保存逻辑，替换后立即落盘
        const { themeId, themeName } = useThemeStore.getState();
        const fullContent = applyMarkdownFileMeta(
          useFileStore.getState().lastSavedContent,
          {
            body: result.markdown,
            theme: themeId,
            themeName,
            title: file.title || stripMarkdownExtension(file.name),
          },
        );
        const saveRes = await electronApi.fs.saveFile({
          filePath: file.path,
          content: fullContent,
        });
        if (saveRes.success) {
          const fileStore = useFileStore.getState();
          fileStore.setLastSavedContent(fullContent);
          fileStore.setLastSavedAt(new Date());
          fileStore.setIsDirty(false);
        } else {
          toast.error("保存失败: " + (saveRes.error || "未知错误"));
        }
      }

      if (result.failed.length > 0) {
        toast.error(
          `已上传 ${result.uploaded} 张图片，${result.failed.length} 张失败：${result.failed
            .map((item) => `${item.src}（${item.reason}）`)
            .join("；")}`,
        );
      } else {
        toast.success(`已上传 ${result.uploaded} 张图片`);
      }
    } catch (error) {
      console.error("本地图片上传失败:", error);
      toast.error(error instanceof Error ? error.message : "本地图片上传失败");
    } finally {
      toast.dismiss(loadingToastId);
      setUploadingLocalImages(false);
    }
  };

  return {
    isElectronEnv,
    canUploadLocalImages,
    uploadingLocalImages,
    uploadLocalImages,
  };
}
