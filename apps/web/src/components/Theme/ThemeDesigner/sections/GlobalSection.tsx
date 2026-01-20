import type { GlobalSectionProps } from "../types";
import { ColorSelector } from "../../ColorSelector";
import { SliderInput } from "../SliderInput";
import {
  fontFamilyOptions,
  fontSizeOptions,
  lineHeightOptions,
  primaryColorOptions,
  boldStyleOptions,
} from "../../../../config/styleOptions";

export function GlobalSection({
  variables,
  updateVariable,
  handlePrimaryColorChange,
}: GlobalSectionProps) {
  return (
    <div className="designer-section">
      <div className="designer-field">
        <label>字体</label>
        <div className="designer-options">
          {fontFamilyOptions.map((opt) => (
            <button
              key={opt.value}
              className={`option-btn ${variables.fontFamily === opt.value ? "active" : ""}`}
              onClick={() => updateVariable("fontFamily", opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="designer-field">
        <label>正文字号</label>
        <div className="designer-options">
          {fontSizeOptions.map((opt) => (
            <button
              key={opt.value}
              className={`option-btn ${variables.fontSize === opt.value ? "active" : ""}`}
              onClick={() => updateVariable("fontSize", opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="designer-field">
        <label>行高</label>
        <div className="designer-options">
          {lineHeightOptions.map((opt) => (
            <button
              key={opt.value}
              className={`option-btn ${variables.lineHeight === opt.value ? "active" : ""}`}
              onClick={() => updateVariable("lineHeight", opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="designer-field">
        <label>全局字间距</label>
        <SliderInput
          value={variables.baseLetterSpacing || 0}
          onChange={(val) => updateVariable("baseLetterSpacing", val)}
          min={0}
          max={10}
          step={0.1}
          unit="px"
        />
      </div>

      <div className="designer-field">
        <label>段落内部间距</label>
        <SliderInput
          value={variables.paragraphPadding ?? 0}
          onChange={(val) => updateVariable("paragraphPadding", val)}
          min={0}
          max={20}
          step={0.1}
        />
      </div>

      <div className="designer-field">
        <label>页面两侧间距</label>
        <SliderInput
          value={variables.pagePadding || 0}
          onChange={(val) => updateVariable("pagePadding", val)}
          min={0}
          max={48}
          step={0.1}
        />
      </div>

      <div className="designer-field">
        <label>正文颜色</label>
        <ColorSelector
          value={variables.paragraphColor}
          presets={[
            { label: "深灰 (推荐)", value: "#333333" },
            { label: "纯黑", value: "#000000" },
            { label: "灰色", value: "#666666" },
          ]}
          onChange={(color) => updateVariable("paragraphColor", color)}
        />
      </div>

      <div className="designer-field">
        <label>主题色</label>
        <ColorSelector
          value={variables.primaryColor}
          presets={primaryColorOptions}
          onChange={handlePrimaryColorChange}
        />
      </div>

      <div className="designer-field">
        <label>加粗样式</label>
        <div className="designer-options">
          {boldStyleOptions.map((opt) => (
            <button
              key={opt.id}
              className={`option-btn ${variables.strongStyle === opt.id ? "active" : ""}`}
              onClick={() => updateVariable("strongStyle", opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
