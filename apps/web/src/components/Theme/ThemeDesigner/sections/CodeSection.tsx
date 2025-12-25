import type { SectionProps, DesignerVariables } from "../types";
import { ColorSelector } from "../../ColorSelector";
import {
  inlineCodeStyleOptions,
  codeBlockThemeOptions,
} from "../../../../config/styleOptions";

interface CodeSectionProps extends SectionProps {
  setVariables: React.Dispatch<React.SetStateAction<DesignerVariables>>;
}

export function CodeSection({
  variables,
  updateVariable,
  setVariables,
}: CodeSectionProps) {
  return (
    <div className="designer-section">
      <div className="designer-group-label">行内代码</div>
      <div className="designer-field">
        <label>样式预设</label>
        <div className="designer-options col-2">
          {inlineCodeStyleOptions.map((opt) => (
            <button
              key={opt.id}
              className={`option-btn ${variables.inlineCodeStyle === opt.id ? "active" : ""}`}
              onClick={() => {
                const updates: Partial<DesignerVariables> = {
                  inlineCodeStyle: opt.id,
                };
                if (opt.id === "color-text") {
                  updates.inlineCodeColor = variables.primaryColor;
                  updates.inlineCodeBackground = "transparent";
                } else if (opt.id === "simple") {
                  updates.inlineCodeColor = "#c7254e";
                  updates.inlineCodeBackground = "#f9f2f4";
                } else if (opt.id === "github") {
                  updates.inlineCodeColor = "#24292e";
                  updates.inlineCodeBackground = "rgba(27,31,35,0.05)";
                }
                setVariables((prev) => ({ ...prev, ...updates }));
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="designer-row">
        <div className="designer-field half">
          <label>文字颜色</label>
          <ColorSelector
            value={variables.inlineCodeColor}
            presets={["#c7254e", "#333", variables.primaryColor]}
            onChange={(color) => updateVariable("inlineCodeColor", color)}
          />
        </div>
        <div className="designer-field half">
          <label>背景颜色</label>
          <ColorSelector
            value={variables.inlineCodeBackground}
            presets={["#f9f2f4", "rgba(27,31,35,0.05)", "transparent"]}
            onChange={(color) => updateVariable("inlineCodeBackground", color)}
          />
        </div>
      </div>

      <div className="designer-group-label mt-4">代码块</div>
      <div className="designer-field">
        <label>字号: {variables.codeFontSize}px</label>
        <input
          type="range"
          className="designer-slider"
          min={12}
          max={16}
          value={variables.codeFontSize}
          onChange={(e) =>
            updateVariable("codeFontSize", Number(e.target.value))
          }
        />
      </div>

      <div className="designer-field-row">
        <span>Mac 风格控制栏</span>
        <label className="designer-switch">
          <input
            type="checkbox"
            checked={variables.showMacBar}
            onChange={(e) => updateVariable("showMacBar", e.target.checked)}
          />
          <span className="switch-slider"></span>
        </label>
      </div>

      <div className="designer-field">
        <label>高亮主题</label>
        <div className="designer-options col-2">
          {codeBlockThemeOptions.map((opt) => (
            <button
              key={opt.id}
              className={`option-btn ${variables.codeTheme === opt.id ? "active" : ""}`}
              onClick={() => {
                const updates: Partial<DesignerVariables> = {
                  codeTheme: opt.id,
                };
                if (opt.id === "github") updates.codeBackground = "#f8f8f8";
                else if (opt.id === "monokai")
                  updates.codeBackground = "#272822";
                else if (opt.id === "vscode")
                  updates.codeBackground = "#1e1e1e";
                else if (opt.id === "night-owl")
                  updates.codeBackground = "#011627";
                setVariables((prev) => ({ ...prev, ...updates }));
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
