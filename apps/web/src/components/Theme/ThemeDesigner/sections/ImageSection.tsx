import type { SectionProps } from "../types";
import { ColorSelector } from "../../ColorSelector";

export function ImageSection({ variables, updateVariable }: SectionProps) {
  return (
    <div className="designer-section">
      <div className="designer-field">
        <label>边距: {variables.imageMargin}px</label>
        <input
          type="range"
          className="designer-slider"
          min={0}
          max={40}
          step={4}
          value={variables.imageMargin}
          onChange={(e) =>
            updateVariable("imageMargin", Number(e.target.value))
          }
        />
      </div>

      <div className="designer-field">
        <label>圆角: {variables.imageBorderRadius}px</label>
        <input
          type="range"
          className="designer-slider"
          min={0}
          max={16}
          value={variables.imageBorderRadius}
          onChange={(e) =>
            updateVariable("imageBorderRadius", Number(e.target.value))
          }
        />
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
