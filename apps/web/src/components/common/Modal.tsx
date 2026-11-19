import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import "./Modal.css";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** 为 false 时禁用遮罩、Esc 与关闭按钮 */
  dismissible?: boolean;
}

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

const getFocusableElements = (container: HTMLElement): HTMLElement[] =>
  Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter(
    (element) => !element.hasAttribute("hidden") && element.tabIndex >= 0,
  );

/**
 * 通用弹窗组件
 * 提供统一的弹窗外观和交互，包括遮罩层、标题栏和关闭按钮
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  className,
  bodyClassName,
  dismissible = true,
}: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const dismissibleRef = useRef(dismissible);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    dismissibleRef.current = dismissible;
  }, [dismissible]);

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const panel = panelRef.current;
    const focusable = panel ? getFocusableElements(panel) : [];
    (focusable[0] ?? panel)?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (dismissibleRef.current) onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel) return;

      const elements = getFocusableElements(panel);
      const first = elements[0] ?? panel;
      const last = elements.at(-1) ?? panel;
      const activeElement = document.activeElement;
      const isOutsideDialog = !panel.contains(activeElement);
      const shouldWrapBack =
        event.shiftKey && (isOutsideDialog || activeElement === first);
      const shouldWrapForward =
        !event.shiftKey && (isOutsideDialog || activeElement === last);

      if (shouldWrapBack) {
        event.preventDefault();
        last.focus();
      } else if (shouldWrapForward) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (previousFocusRef.current?.isConnected) {
        previousFocusRef.current.focus();
      }
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={dismissible ? onClose : undefined}>
      <div
        ref={panelRef}
        className={`modal-panel ${className || ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-heading">
            <h3 id={titleId}>{title}</h3>
            {description && <p id={descriptionId}>{description}</p>}
          </div>
          <button
            className="modal-close"
            onClick={dismissible ? onClose : undefined}
            aria-label="关闭"
            disabled={!dismissible}
          >
            <X size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
        <div className={`modal-body ${bodyClassName || ""}`}>{children}</div>
      </div>
    </div>
  );
}
