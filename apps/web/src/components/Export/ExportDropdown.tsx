import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { useUITheme } from "../../hooks/useUITheme";
import "./ExportDropdown.css";

export interface ExportDropdownOption {
  value: string;
  label: string;
  /** 已加载的字体用自身字体渲染选项名 */
  fontFamily?: string;
  /** 字体样张，直接展示字体外观 */
  image?: { light: string; dark: string };
}

interface ExportDropdownProps {
  id?: string;
  value: string;
  options: ExportDropdownOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  disabled?: boolean;
}

interface MenuPosition {
  top: number;
  left: number;
  width: number;
}

const MENU_MAX_HEIGHT = 360;
const VIEWPORT_MARGIN = 8;

export function ExportDropdown({
  id,
  value,
  options,
  onChange,
  ariaLabel,
  disabled = false,
}: ExportDropdownProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const uiTheme = useUITheme((state) => state.theme);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selected =
    options.find((option) => option.value === value) ?? options[0];

  const updatePosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const menuHeight = Math.min(MENU_MAX_HEIGHT, options.length * 38 + 12);
    const openUp =
      rect.bottom + VIEWPORT_MARGIN + menuHeight > window.innerHeight;
    setPosition({
      top: openUp
        ? Math.max(VIEWPORT_MARGIN, rect.top - menuHeight - 6)
        : rect.bottom + 6,
      left: Math.max(
        VIEWPORT_MARGIN,
        Math.min(rect.left, window.innerWidth - rect.width - VIEWPORT_MARGIN),
      ),
      width: rect.width,
    });
  };

  const close = () => {
    setOpen(false);
    setPosition(null);
  };

  const choose = (option: ExportDropdownOption) => {
    onChange(option.value);
    close();
  };

  useEffect(() => {
    if (!open) return;
    updatePosition();
    setActiveIndex(
      Math.max(
        0,
        options.findIndex((option) => option.value === value),
      ),
    );

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      close();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close();
        triggerRef.current?.focus();
      }
    };
    const handleResize = () => close();
    const handleScroll = (event: Event) => {
      const target = event.target;
      if (target instanceof Node && menuRef.current?.contains(target)) return;
      close();
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, options.length]);

  useEffect(() => {
    const menu = menuRef.current;
    if (!open || !menu) return;
    // 菜单内容不需要滚动时，阻止滚轮把后面的设置面板一起滚走
    const handleWheel = (event: WheelEvent) => {
      if (menu.scrollHeight <= menu.clientHeight) event.preventDefault();
    };
    menu.addEventListener("wheel", handleWheel, { passive: false });
    return () => menu.removeEventListener("wheel", handleWheel);
  }, [open, position]);

  useEffect(() => {
    if (!open) return;
    menuRef.current
      ?.querySelector<HTMLElement>(".export-select-option.is-active")
      ?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  const handleTriggerKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
  ) => {
    if (disabled) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((index) =>
        Math.min(options.length - 1, Math.max(0, index + delta)),
      );
      return;
    }
    if (event.key === "Tab") {
      close();
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      if (open) {
        event.preventDefault();
        const option = options[activeIndex];
        if (option) choose(option);
      }
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className="export-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (open ? close() : setOpen(true))}
        onKeyDown={handleTriggerKeyDown}
      >
        <span
          className="export-select-value"
          style={
            selected?.fontFamily
              ? { fontFamily: selected.fontFamily }
              : undefined
          }
        >
          {selected?.label ?? "请选择"}
        </span>
        <ChevronDown size={14} strokeWidth={2} aria-hidden="true" />
      </button>

      {open &&
        position &&
        createPortal(
          <div
            ref={menuRef}
            className="export-select-menu"
            role="listbox"
            aria-label={ariaLabel}
            style={{
              top: position.top,
              left: position.left,
              width: position.width,
            }}
            onMouseDown={(event) => event.preventDefault()}
          >
            {options.map((option, index) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={option.value === value}
                className={`export-select-option${
                  index === activeIndex ? " is-active" : ""
                }`}
                onClick={() => choose(option)}
                onMouseEnter={() => setActiveIndex(index)}
              >
                {option.image ? (
                  <img
                    className="export-select-option-image"
                    src={
                      uiTheme === "dark"
                        ? option.image.dark
                        : option.image.light
                    }
                    alt={option.label}
                  />
                ) : (
                  <span
                    className="export-select-option-label"
                    style={
                      option.fontFamily
                        ? { fontFamily: option.fontFamily }
                        : undefined
                    }
                  >
                    {option.label}
                  </span>
                )}
                {option.value === value && (
                  <Check
                    className="export-select-check"
                    size={14}
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                )}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
