import { useState, useEffect } from "react";
import type { DesignerVariables, HeadingStyle, HeadingLevel } from "./types";
import { defaultVariables } from "./defaults";
import { generateCSS } from "./generateCSS";
import {
  GlobalSection,
  HeadingSection,
  ParagraphSection,
  QuoteSection,
  ListSection,
  CodeSection,
  ImageSection,
  TableHrSection,
  OtherSection,
} from "./sections";
import "../ThemeDesigner.css";

export type { DesignerVariables, HeadingStyle };
export { defaultVariables };

interface ThemeDesignerProps {
  onCSSChange: (css: string) => void;
  onVariablesChange?: (variables: DesignerVariables) => void;
  initialVariables?: DesignerVariables;
  initialCSS?: string;
}

const sections = [
  { id: "global", label: "全局" },
  { id: "heading", label: "标题" },
  { id: "paragraph", label: "段落" },
  { id: "quote", label: "引用" },
  { id: "list", label: "列表" },
  { id: "code", label: "代码" },
  { id: "image", label: "图片" },
  { id: "table", label: "表格" },
  { id: "other", label: "其他" },
];

export function ThemeDesigner({
  onCSSChange,
  onVariablesChange,
  initialVariables,
  initialCSS,
}: ThemeDesignerProps) {
  const [variables, setVariables] = useState<DesignerVariables>(
    initialVariables || defaultVariables,
  );
  const [activeSection, setActiveSection] = useState<string>("global");
  const [activeHeading, setActiveHeading] = useState<HeadingLevel>("h1");

  useEffect(() => {
    if (initialVariables) {
      setVariables(initialVariables);
    } else {
      setVariables(defaultVariables);
    }
  }, [initialVariables]);

  useEffect(() => {
    if (!initialVariables && !initialCSS) {
      onCSSChange(generateCSS(defaultVariables));
      onVariablesChange?.(defaultVariables);
    }
  }, [initialVariables, initialCSS, onCSSChange, onVariablesChange]);

  useEffect(() => {
    onCSSChange(generateCSS(variables));
    onVariablesChange?.(variables);
  }, [variables, onCSSChange, onVariablesChange]);

  const updateVariable = <K extends keyof DesignerVariables>(
    key: K,
    value: DesignerVariables[K],
  ) => {
    setVariables((prev) => ({ ...prev, [key]: value }));
  };

  const updateHeading = (level: HeadingLevel, style: Partial<HeadingStyle>) => {
    setVariables((prev) => ({
      ...prev,
      [level]: { ...prev[level], ...style },
    }));
  };

  const handlePrimaryColorChange = (newColor: string) => {
    setVariables((prev) => ({
      ...prev,
      primaryColor: newColor,
      listMarkerColor: newColor,
      listMarkerColorL2: newColor,
    }));
  };

  return (
    <div className="theme-designer">
      {/* 分类 Tab */}
      <div className="designer-tabs">
        {sections.map((section) => (
          <button
            key={section.id}
            className={`designer-tab ${activeSection === section.id ? "active" : ""}`}
            onClick={() => setActiveSection(section.id)}
          >
            {section.label}
          </button>
        ))}
      </div>

      <div className="designer-content">
        {activeSection === "global" && (
          <GlobalSection
            variables={variables}
            updateVariable={updateVariable}
            handlePrimaryColorChange={handlePrimaryColorChange}
          />
        )}

        {activeSection === "heading" && (
          <HeadingSection
            variables={variables}
            updateVariable={updateVariable}
            activeHeading={activeHeading}
            setActiveHeading={setActiveHeading}
            updateHeading={updateHeading}
          />
        )}

        {activeSection === "paragraph" && (
          <ParagraphSection
            variables={variables}
            updateVariable={updateVariable}
          />
        )}

        {activeSection === "quote" && (
          <QuoteSection variables={variables} updateVariable={updateVariable} />
        )}

        {activeSection === "list" && (
          <ListSection variables={variables} updateVariable={updateVariable} />
        )}

        {activeSection === "code" && (
          <CodeSection
            variables={variables}
            updateVariable={updateVariable}
            setVariables={setVariables}
          />
        )}

        {activeSection === "image" && (
          <ImageSection variables={variables} updateVariable={updateVariable} />
        )}

        {activeSection === "table" && (
          <TableHrSection
            variables={variables}
            updateVariable={updateVariable}
          />
        )}

        {activeSection === "other" && (
          <OtherSection variables={variables} updateVariable={updateVariable} />
        )}
      </div>
    </div>
  );
}
