import type { SectionProps } from "../types";
import { ColorSelector } from "../../ColorSelector";
import { quoteStylePresets } from "../../../../config/styleOptions";

export function QuoteSection({ variables, updateVariable }: SectionProps) {
  return (
    <div className="designer-section">
      <div className="designer-field">
        <label>样式预设</label>
        <div className="designer-options">
          {quoteStylePresets.map((opt) => (
            <button
              key={opt.id}
              className={`option-btn ${variables.quotePreset === opt.id ? "active" : ""}`}
              onClick={() => updateVariable("quotePreset", opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="designer-field">
        <label>引用背景</label>
        <ColorSelector
          value={variables.quoteBackground}
          presets={["#f5f5f5", "#f0f9ff", "#f0fdf4", "#fef3c7", "#fce7f3"]}
          onChange={(color) => updateVariable("quoteBackground", color)}
        />
      </div>

      <div className="designer-field">
        <label>边框颜色</label>
        <ColorSelector
          value={variables.quoteBorderColor}
          presets={[
            "#ddd",
            "#0ea5e9",
            "#22c55e",
            "#f59e0b",
            "#ec4899",
            variables.primaryColor,
          ]}
          onChange={(color) => updateVariable("quoteBorderColor", color)}
        />
      </div>

      <div className="designer-field">
        <label>引用文字颜色</label>
        <ColorSelector
          value={variables.quoteTextColor}
          presets={["#666", "#333", "#000", variables.primaryColor]}
          onChange={(color) => updateVariable("quoteTextColor", color)}
        />
      </div>
    </div>
  );
}
