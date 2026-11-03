import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import { getDesktop } from "../../lib/platformAdapter";
import { Modal } from "../common";
import "./UpdateModal.css";

const V161_URL = "https://github.com/tenngoxars/WeMD/releases/tag/v1.6.1";

// 跳过 v1.6.1 直接升级时提示一次如何迁移旧版设置；判断与「只提示一次」在 migration.rs
export function MigrationHintModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // 只在为 true 时打开：StrictMode 下第二次调用返回 false，不能把弹窗关掉
    getDesktop()
      ?.migration?.takeHint()
      .then((hint) => hint && setOpen(true))
      .catch(() => {});
  }, []);

  const close = () => setOpen(false);

  return (
    <Modal
      open={open}
      onClose={close}
      title="迁移旧版设置"
      className="update-modal"
      bodyClassName="update-modal-body"
    >
      <p className="update-modal-text">
        检测到旧版 WeMD 的数据，但没有找到设置备份，所以 AI
        Key、图床配置和界面偏好没有导入。
      </p>
      <p className="update-modal-text">
        想保留这些设置：先用 WeMD v1.6.1 打开一次，再打开新版，设置会自动导入。
      </p>
      <p className="update-modal-text">
        文章保存在你的文件夹里，不受影响。这条提示只显示一次。
      </p>
      <div className="update-modal-actions">
        <div className="update-modal-actions-main">
          <button className="update-modal-btn" onClick={close}>
            知道了
          </button>
          <button
            className="update-modal-btn primary"
            onClick={() => {
              void getDesktop()?.shell?.openExternal(V161_URL);
              close();
            }}
          >
            <Download size={14} aria-hidden="true" />
            下载 v1.6.1
          </button>
        </div>
      </div>
    </Modal>
  );
}
