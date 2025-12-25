import type { SectionProps } from "../types";

export function ParagraphSection({ variables, updateVariable }: SectionProps) {
  return (
    <div className="designer-section">
      <div className="designer-field">
        <label>段落间距: {variables.paragraphMargin}px</label>
        <input
          type="range"
          className="designer-slider"
          min={8}
          max={32}
          step={2}
          value={variables.paragraphMargin}
          onChange={(e) =>
            updateVariable("paragraphMargin", Number(e.target.value))
          }
        />
      </div>

      <div className="designer-field-row">
        <span>段落首行缩进</span>
        <label className="designer-switch">
          <input
            type="checkbox"
            checked={variables.textIndent}
            onChange={(e) => updateVariable("textIndent", e.target.checked)}
          />
          <span className="switch-slider"></span>
        </label>
      </div>

      <div className="designer-field-row">
        <span>两端对齐</span>
        <label className="designer-switch">
          <input
            type="checkbox"
            checked={variables.textJustify}
            onChange={(e) => updateVariable("textJustify", e.target.checked)}
          />
          <span className="switch-slider"></span>
        </label>
      </div>
    </div>
  );
}
