import type { SectionProps } from "../types";
import { ColorSelector } from "../../ColorSelector";
import { SliderInput } from "../SliderInput";

export function ImageSection({ variables, updateVariable }: SectionProps) {
  return (
    <div className="designer-section">
      <div className="designer-field">
        <label>边距</label>
        <SliderInput
          value={variables.imageMargin}
          onChange={(val) => updateVariable("imageMargin", val)}
          min={0}
          max={40}
          step={4}
        />
      </div>

      <div className="designer-field">
        <label>圆角</label>
        <SliderInput
          value={variables.imageBorderRadius}
          onChange={(val) => updateVariable("imageBorderRadius", val)}
          min={0}
          max={16}
        />
      </div>

      <div className="designer-field-row">
        <span>阴影</span>
        <label className="designer-switch">
          <input
            type="checkbox"
            checked={variables.imageShadow}
            onChange={(e) => updateVariable("imageShadow", e.target.checked)}
          />
          <span className="switch-slider" />
        </label>
      </div>

      <div className="designer-group-label mt-4">图片说明</div>
      <div className="designer-field">
        <label>说明文字颜色</label>
        <ColorSelector
          value={variables.imageCaptionColor}
          presets={["#999", "#666", "#333", variables.primaryColor]}
          onChange={(color) => updateVariable("imageCaptionColor", color)}
        />
      </div>

      <div className="designer-field">
        <label>说明文字大小</label>
        <div className="designer-options col-4">
          {[12, 13, 14, 15].map((size) => (
            <button
              key={size}
              className={`option-btn ${variables.imageCaptionFontSize === size ? "active" : ""}`}
              onClick={() => updateVariable("imageCaptionFontSize", size)}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      <div className="designer-field">
        <label>说明文字对齐</label>
        <div className="designer-options col-3">
          {[
            { id: "left", label: "居左" },
            { id: "center", label: "居中" },
            { id: "right", label: "居右" },
          ].map((opt) => (
            <button
              key={opt.id}
              className={`option-btn ${variables.imageCaptionTextAlign === opt.id ? "active" : ""}`}
              onClick={() => updateVariable("imageCaptionTextAlign", opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
