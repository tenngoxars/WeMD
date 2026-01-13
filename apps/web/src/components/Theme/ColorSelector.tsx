import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Plus } from "lucide-react";

/**
 * 标准化颜色值，统一转为 6 位大写 Hex。
 * 支持 #333 -> #333333 等转换。
 */
function normalizeColor(color: string): string {
  if (!color) return "";
  const trimmed = color.trim().toUpperCase();
  if (!trimmed.startsWith("#")) return trimmed; // 非 hex 关键词保持原样

  let hex = trimmed.slice(1);
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  return `#${hex}`;
}

// HSL 转 Hex
function hslToHex(h: number, s: number, l: number): string {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

// Hex 转 HSL
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { h: 0, s: 0, l: 0 };
  const r = parseInt(result[1], 16) / 255;
  const g = parseInt(result[2], 16) / 255;
  const b = parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0,
    s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

interface ColorPreset {
  label?: string;
  value: string;
  displayColor?: string;
}

interface ColorSelectorProps {
  value: string;
  presets: (string | ColorPreset)[];
  onChange: (color: string) => void;
}

export function ColorSelector({
  value,
  presets,
  onChange,
}: ColorSelectorProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [tempColor, setTempColor] = useState(value);
  const [hsl, setHsl] = useState(
    hexToHsl((value || "").startsWith("#") ? value : "#000000"),
  );
  const [popoverPos, setPopoverPos] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // 计算实际显示的当前颜色（用于比较）
  // 如果 value 不带 #，它可能是一个 keyword。我们需要检查 presets 里是否定义了它的展示色。
  const getResolvedColor = (val: string, items: ColorPreset[]) => {
    const normalized = normalizeColor(val);
    const match = items.find((p) => normalizeColor(p.value) === normalized);
    if (match && match.displayColor) return normalizeColor(match.displayColor);
    return normalized;
  };

  const normalizedPresets: ColorPreset[] = presets.map((p) =>
    typeof p === "string" ? { value: p } : p,
  );
  const currentValueResolved = getResolvedColor(value, normalizedPresets);

  // 标准化并去重预设值：基于“最终显示的颜色”去重
  const uniquePresets: ColorPreset[] = [];
  const seenDisplayColors = new Set<string>();

  normalizedPresets.forEach((item) => {
    const resolved = normalizeColor(item.displayColor || item.value);
    if (!seenDisplayColors.has(resolved)) {
      seenDisplayColors.add(resolved);
      uniquePresets.push(item);
    }
  });

  // 计算自定义颜色按钮是否显示：如果当前解析出的颜色不在预设的显示颜色中，则显示
  const isValueInDisplayPresets = uniquePresets.some(
    (p) => normalizeColor(p.displayColor || p.value) === currentValueResolved,
  );
  const customColor =
    !currentValueResolved || isValueInDisplayPresets ? null : value;

  useEffect(() => {
    if (showColorPicker) {
      const startColor = (value || "").startsWith("#") ? value : "#000000";
      setTempColor(startColor);
      setHsl(hexToHsl(startColor));

      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        setPopoverPos({
          top: rect.top,
          left: rect.left + rect.width / 2,
        });
      }
    } else {
      setPopoverPos(null);
    }
  }, [showColorPicker, value]);

  const updateHsl = (key: "h" | "s" | "l", v: number) => {
    const newHsl = { ...hsl, [key]: v };
    setHsl(newHsl);
    const newHex = hslToHex(newHsl.h, newHsl.s, newHsl.l);
    setTempColor(newHex);
  };

  const handleConfirm = () => {
    if (/^#[0-9A-Fa-f]{3,6}$/.test(tempColor)) {
      onChange(tempColor);
      setShowColorPicker(false);
    }
  };

  // 透明背景样式
  const transparentPattern = {
    backgroundImage:
      "linear-gradient(45deg, #e6e6e6 25%, transparent 25%), linear-gradient(-45deg, #e6e6e6 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e6e6e6 75%), linear-gradient(-45deg, transparent 75%, #e6e6e6 75%)",
    backgroundSize: "6px 6px",
    backgroundPosition: "0 0, 0 3px, 3px -3px, -3px 0px",
    backgroundColor: "#fff",
  };

  return (
    <div className="designer-colors">
      {uniquePresets.map((item, idx) => {
        const itemResolved = normalizeColor(item.displayColor || item.value);
        const isActive = itemResolved === currentValueResolved;
        const isTransparent = itemResolved === "TRANSPARENT";

        return (
          <button
            key={`${item.value}-${idx}`}
            className={`color-btn ${isActive ? "active" : ""}`}
            style={{
              backgroundColor: itemResolved,
              ...(isTransparent ? transparentPattern : {}),
            }}
            onClick={() => onChange(item.value)}
            title={item.label || item.value}
          />
        );
      })}

      {customColor && (
        <button
          className="color-btn active"
          style={{
            backgroundColor: currentValueResolved.startsWith("#")
              ? currentValueResolved
              : "transparent",
            ...(currentValueResolved === "TRANSPARENT"
              ? transparentPattern
              : {}),
          }}
          onClick={() => onChange(customColor)}
          title="自定义颜色"
        />
      )}

      <div className="custom-color-wrapper" style={{ position: "relative" }}>
        <button
          ref={triggerRef}
          className="color-btn custom-color-picker"
          title="选择新颜色"
          onClick={() => setShowColorPicker(!showColorPicker)}
        >
          <Plus size={14} className="plus-icon" />
        </button>

        {showColorPicker &&
          popoverPos &&
          createPortal(
            <>
              <div
                className="color-picker-mask"
                style={{ position: "fixed", inset: 0, zIndex: 999 }}
                onClick={() => setShowColorPicker(false)}
              />
              <div
                className="custom-color-popover"
                style={{
                  position: "fixed",
                  bottom: `${window.innerHeight - popoverPos.top + 10}px`,
                  left: `${popoverPos.left}px`,
                  transform: "translateX(-50%)",
                  zIndex: 1000,
                  margin: 0,
                  top: "auto",
                  background: "white",
                }}
              >
                <div
                  className="popover-arrow"
                  style={{
                    bottom: "-6px",
                    top: "auto",
                    borderTop: "none",
                    borderLeft: "none",
                    borderBottom: "1px solid var(--border-light)",
                    borderRight: "1px solid var(--border-light)",
                    transform: "translateX(-50%) rotate(45deg)",
                    background: "white",
                  }}
                />

                <div
                  className="color-preview"
                  style={{ backgroundColor: tempColor }}
                />

                <div className="color-slider-row">
                  <span className="label">H</span>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    value={hsl.h}
                    className="hue-slider"
                    style={{
                      background:
                        "linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)",
                    }}
                    onChange={(e) => updateHsl("h", parseInt(e.target.value))}
                  />
                </div>

                <div className="color-slider-row">
                  <span className="label">S</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={hsl.s}
                    className="saturation-slider"
                    style={{
                      background: `linear-gradient(to right, hsl(${hsl.h}, 0%, 50%), hsl(${hsl.h}, 100%, 50%))`,
                    }}
                    onChange={(e) => updateHsl("s", parseInt(e.target.value))}
                  />
                </div>

                <div className="color-slider-row">
                  <span className="label">L</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={hsl.l}
                    className="lightness-slider"
                    style={{
                      background: `linear-gradient(to right, #000 0%, hsl(${hsl.h}, ${hsl.s}%, 50%) 50%, #fff 100%)`,
                    }}
                    onChange={(e) => updateHsl("l", parseInt(e.target.value))}
                  />
                </div>

                <input
                  type="text"
                  value={tempColor}
                  placeholder="#000000"
                  onChange={(e) => {
                    const v = e.target.value;
                    setTempColor(v);
                    if (/^#[0-9A-Fa-f]{3,6}$/.test(v)) {
                      setHsl(hexToHsl(v));
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleConfirm();
                  }}
                />

                <button
                  className="confirm-btn"
                  disabled={!/^#[0-9A-Fa-f]{3,6}$/.test(tempColor)}
                  onClick={handleConfirm}
                >
                  确定
                </button>
              </div>
            </>,
            document.body,
          )}
      </div>
    </div>
  );
}
