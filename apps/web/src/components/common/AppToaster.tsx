import { Toaster, ToastBar } from "react-hot-toast";
import "./AppToaster.css";

// 全局通知容器：调用方式仍是 react-hot-toast，这里只接管外观与进出场动效
export function AppToaster() {
  return (
    <Toaster
      position="top-center"
      containerClassName="app-toaster"
      toastOptions={{
        className: "premium-toast",
        success: {
          iconTheme: {
            primary: "var(--accent-primary)",
            secondary: "var(--on-accent)",
          },
          duration: 2000,
        },
        error: {
          iconTheme: { primary: "#ef4444", secondary: "#fff" },
          duration: 3000,
        },
      }}
    >
      {(t) => (
        <ToastBar
          toast={t}
          // 高度测出来之前保留库自带的 opacity: 0，避免还没定位就开始播放
          style={
            t.height
              ? {
                  animation: t.visible
                    ? "app-toast-in 0.62s both"
                    : "app-toast-out 0.3s cubic-bezier(0.55, 0, 1, 0.45) both",
                }
              : undefined
          }
        >
          {({ icon, message }) => (
            <>
              {icon}
              {/* 同一条通知从「加载中」变成结果时，按类型重挂载，文字换一次而不是硬切 */}
              <div key={t.type} className="app-toast__message">
                {message}
              </div>
            </>
          )}
        </ToastBar>
      )}
    </Toaster>
  );
}
