import type { HeadingSectionProps, HeadingLevel } from "../types";
import { ColorSelector } from "../../ColorSelector";
import {
  headingSizePresets,
  marginPresets,
  headingStylePresets,
} from "../../../../config/styleOptions";

const headingTabs: { id: HeadingLevel; label: string }[] = [
  { id: "h1", label: "H1" },
  { id: "h2", label: "H2" },
  { id: "h3", label: "H3" },
  { id: "h4", label: "H4" },
];

export function HeadingSection({
  variables,
  activeHeading,
  setActiveHeading,
  updateHeading,
}: HeadingSectionProps) {
  return (
    <div className="designer-section">
      <div className="designer-subtabs">
        {headingTabs.map((tab) => (
          <button
            key={tab.id}
            className={`subtab ${activeHeading === tab.id ? "active" : ""}`}
            onClick={() => setActiveHeading(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="designer-field">
        <div className="designer-field-header">
          <label>样式预设</label>
          <div className="compact-switch">
            <span>居中</span>
            <label className="designer-switch">
              <input
                type="checkbox"
                checked={variables[activeHeading].centered}
                onChange={(e) =>
                  updateHeading(activeHeading, { centered: e.target.checked })
                }
              />
              <span className="switch-slider"></span>
            </label>
          </div>
        </div>
        <div className="designer-options">
          <button
            className={`option-btn ${!variables[activeHeading].preset || variables[activeHeading].preset === "simple" ? "active" : ""}`}
            onClick={() => updateHeading(activeHeading, { preset: "simple" })}
          >
            无样式
          </button>
          {headingStylePresets
            .filter((p) => p.id !== "simple")
            .map((preset) => (
              <button
                key={preset.id}
                className={`option-btn ${variables[activeHeading].preset === preset.id ? "active" : ""}`}
                onClick={() =>
                  updateHeading(activeHeading, { preset: preset.id })
                }
              >
                {preset.label}
              </button>
            ))}
        </div>
      </div>

      <div className="designer-field">
        <label>字号: {variables[activeHeading].fontSize}px</label>
        <input
          type="range"
          className="designer-slider"
          min={headingSizePresets[activeHeading].min}
          max={headingSizePresets[activeHeading].max}
          value={variables[activeHeading].fontSize}
          onChange={(e) =>
            updateHeading(activeHeading, { fontSize: Number(e.target.value) })
          }
        />
      </div>

      <div className="designer-field">
        <label>字重</label>
        <div className="designer-options mini">
          <button
            className={`option-btn ${variables[activeHeading].fontWeight !== "normal" ? "active" : ""}`}
            onClick={() => updateHeading(activeHeading, { fontWeight: "bold" })}
          >
            加粗
          </button>
          <button
            className={`option-btn ${variables[activeHeading].fontWeight === "normal" ? "active" : ""}`}
            onClick={() =>
              updateHeading(activeHeading, { fontWeight: "normal" })
            }
          >
            常规
          </button>
        </div>
      </div>

      <div className="designer-field">
        <label>字间距: {variables[activeHeading].letterSpacing}px</label>
        <input
          type="range"
          className="designer-slider"
          min={0}
          max={10}
          step={0.5}
          value={variables[activeHeading].letterSpacing}
          onChange={(e) =>
            updateHeading(activeHeading, {
              letterSpacing: Number(e.target.value),
            })
          }
        />
      </div>

      <div className="designer-field">
        <label>文字颜色</label>
        <ColorSelector
          value={variables[activeHeading].color}
          presets={["#000", "#333", "#666", variables.primaryColor]}
          onChange={(color) => updateHeading(activeHeading, { color })}
        />
      </div>

      <div className="designer-field">
        <label>上边距: {variables[activeHeading].marginTop}px</label>
        <input
          type="range"
          className="designer-slider"
          min={marginPresets.min}
          max={marginPresets.max}
          step={marginPresets.step}
          value={variables[activeHeading].marginTop}
          onChange={(e) =>
            updateHeading(activeHeading, { marginTop: Number(e.target.value) })
          }
        />
      </div>

      <div className="designer-field">
        <label>下边距: {variables[activeHeading].marginBottom}px</label>
        <input
          type="range"
          className="designer-slider"
          min={marginPresets.min}
          max={marginPresets.max}
          step={marginPresets.step}
          value={variables[activeHeading].marginBottom}
          onChange={(e) =>
            updateHeading(activeHeading, {
              marginBottom: Number(e.target.value),
            })
          }
        />
      </div>
    </div>
  );
}
