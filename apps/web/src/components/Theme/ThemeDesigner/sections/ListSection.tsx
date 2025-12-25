import type { SectionProps } from "../types";
import { ColorSelector } from "../../ColorSelector";
import {
  ulStyleOptions,
  olStyleOptions,
} from "../../../../config/styleOptions";

export function ListSection({ variables, updateVariable }: SectionProps) {
  return (
    <div className="designer-section">
      <div className="designer-row">
        <div className="designer-field half">
          <label>一级标识颜色</label>
          <ColorSelector
            value={variables.listMarkerColor}
            presets={[variables.primaryColor]}
            onChange={(color) => updateVariable("listMarkerColor", color)}
          />
        </div>
        <div className="designer-field half">
          <label>二级标识颜色</label>
          <ColorSelector
            value={variables.listMarkerColorL2}
            presets={[variables.primaryColor]}
            onChange={(color) => updateVariable("listMarkerColorL2", color)}
          />
        </div>
      </div>

      <div className="designer-field">
        <label>列表项间距: {variables.listSpacing}px</label>
        <input
          type="range"
          className="designer-slider"
          min={0}
          max={20}
          step={2}
          value={variables.listSpacing}
          onChange={(e) =>
            updateVariable("listSpacing", Number(e.target.value))
          }
        />
      </div>

      <div className="designer-field">
        <label>无序列表符号</label>
        <div className="level-group">
          <span className="level-tag">一级</span>
          <div className="designer-options">
            {ulStyleOptions.map((opt) => (
              <button
                key={opt.value}
                className={`option-btn ${variables.ulStyle === opt.value ? "active" : ""}`}
                onClick={() => updateVariable("ulStyle", opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="level-group mt-2">
          <span className="level-tag">二级</span>
          <div className="designer-options">
            {ulStyleOptions.map((opt) => (
              <button
                key={opt.value + "L2"}
                className={`option-btn ${variables.ulStyleL2 === opt.value ? "active" : ""}`}
                onClick={() => updateVariable("ulStyleL2", opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="designer-field">
        <label>有序列表符号</label>
        <div className="level-group">
          <span className="level-tag">一级</span>
          <div className="designer-options">
            {olStyleOptions.map((opt) => (
              <button
                key={opt.value}
                className={`option-btn ${variables.olStyle === opt.value ? "active" : ""}`}
                onClick={() => updateVariable("olStyle", opt.value)}
              >
                {opt.label.split(" ")[0]}
              </button>
            ))}
          </div>
        </div>
        <div className="level-group mt-2">
          <span className="level-tag">二级</span>
          <div className="designer-options">
            {olStyleOptions.map((opt) => (
              <button
                key={opt.value + "L2"}
                className={`option-btn ${variables.olStyleL2 === opt.value ? "active" : ""}`}
                onClick={() => updateVariable("olStyleL2", opt.value)}
              >
                {opt.label.split(" ")[0]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
