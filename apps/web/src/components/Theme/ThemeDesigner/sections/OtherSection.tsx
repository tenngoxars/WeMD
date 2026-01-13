import type { SectionProps } from "../types";
import { ColorSelector } from "../../ColorSelector";

export function OtherSection({ variables, updateVariable }: SectionProps) {
  return (
    <div className="designer-section">
      {/* 链接 */}
      <div className="designer-group-label">链接</div>
      <div className="designer-field">
        <label>链接颜色</label>
        <ColorSelector
          value={variables.linkColor || variables.primaryColor}
          presets={[variables.primaryColor, "#0070f3", "#0366d6", "#40a9ff"]}
          onChange={(color) => updateVariable("linkColor", color)}
        />
      </div>
      <div className="designer-field-row">
        <span>显示下划线</span>
        <label className="designer-switch">
          <input
            type="checkbox"
            checked={variables.linkUnderline}
            onChange={(e) => updateVariable("linkUnderline", e.target.checked)}
          />
          <span className="switch-slider"></span>
        </label>
      </div>

      {/* 文本样式 */}
      <div className="designer-group-label mt-4">文本样式</div>
      <div className="designer-field">
        <label>斜体颜色</label>
        <ColorSelector
          value={variables.italicColor}
          presets={["inherit", variables.primaryColor, "#666", "#999"]}
          onChange={(color) => updateVariable("italicColor", color)}
        />
      </div>
      <div className="designer-field">
        <label>删除线颜色</label>
        <ColorSelector
          value={variables.delColor}
          presets={["#999", "#ccc", "#666", variables.primaryColor]}
          onChange={(color) => updateVariable("delColor", color)}
        />
      </div>
      <div className="designer-field">
        <label>加粗颜色</label>
        <ColorSelector
          value={variables.strongColor || "inherit"}
          presets={["inherit", variables.primaryColor, "#333"]}
          onChange={(color) => updateVariable("strongColor", color)}
        />
      </div>
      <div className="designer-row">
        <div className="designer-field half">
          <label>高亮背景</label>
          <ColorSelector
            value={variables.markBackground}
            presets={["#fff5b1", "#ffe4e1", "#e6f7ff", "#f6ffed"]}
            onChange={(color) => updateVariable("markBackground", color)}
          />
        </div>
        <div className="designer-field half">
          <label>高亮文字</label>
          <ColorSelector
            value={variables.markColor}
            presets={["inherit", "#333", variables.primaryColor]}
            onChange={(color) => updateVariable("markColor", color)}
          />
        </div>
      </div>

      {/* 脚注 */}
      <div className="designer-group-label mt-4">脚注</div>
      <div className="designer-field">
        <label>脚注颜色</label>
        <ColorSelector
          value={variables.footnoteColor || variables.primaryColor}
          presets={[
            {
              label: "跟随主题",
              value: "",
              displayColor: variables.primaryColor,
            },
            { label: "深灰", value: "#333333" },
            { label: "灰", value: "#666666" },
            { label: "细灰", value: "#999999" },
          ]}
          onChange={(color) => updateVariable("footnoteColor", color)}
        />
      </div>
      <div className="designer-field">
        <label>详情字号</label>
        <div className="designer-options col-4">
          {[11, 12, 13, 14].map((size) => (
            <button
              key={size}
              className={`option-btn ${variables.footnoteFontSize === size ? "active" : ""}`}
              onClick={() => updateVariable("footnoteFontSize", size)}
            >
              {size}
            </button>
          ))}
        </div>
      </div>
      <div className="designer-field">
        <label>栏目标题</label>
        <input
          type="text"
          className="designer-input"
          value={variables.footnoteHeader}
          onChange={(e) => updateVariable("footnoteHeader", e.target.value)}
          placeholder="留空则不显示标题..."
        />
      </div>
      <div className="designer-field">
        <label>标题颜色</label>
        <ColorSelector
          value={variables.footnoteHeaderColor || variables.primaryColor}
          presets={[variables.primaryColor]}
          onChange={(color) => updateVariable("footnoteHeaderColor", color)}
        />
      </div>
      <div className="designer-field">
        <label>标题样式</label>
        <div className="designer-options col-5">
          {[
            { id: "simple", label: "简约" },
            { id: "left-border", label: "竖线" },
            { id: "bottom-border", label: "下划线" },
            { id: "background", label: "背景块" },
            { id: "pill", label: "胶囊" },
          ].map((style) => (
            <button
              key={style.id}
              className={`option-btn ${variables.footnoteHeaderStyle === style.id ? "active" : ""}`}
              onClick={() => updateVariable("footnoteHeaderStyle", style.id)}
            >
              {style.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
