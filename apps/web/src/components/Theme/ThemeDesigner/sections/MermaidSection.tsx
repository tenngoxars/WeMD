import type { SectionProps } from "../types";

export function MermaidSection({ variables, updateVariable }: SectionProps) {
  const themes = [
    { id: "base", label: "基础 (Base)" },
    { id: "default", label: "默认 (Default)" },
    { id: "forest", label: "森林 (Forest)" },
    { id: "neutral", label: "中性 (Neutral)" },
    { id: "dark", label: "深色 (Dark)" },
  ];

  return (
    <div className="designer-section">
      <div className="designer-group-label">Mermaid 设置</div>

      <div className="designer-field">
        <label>基准主题</label>
        <div className="designer-options col-2">
          {themes.map((opt) => (
            <button
              key={opt.id}
              className={`option-btn ${variables.mermaidTheme === opt.id ? "active" : ""}`}
              onClick={() => updateVariable("mermaidTheme", opt.id as any)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
