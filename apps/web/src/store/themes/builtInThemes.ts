import { builtInThemeCatalog } from "@wemd/core";
import type {
  DesignerVariables,
  HeadingStyle,
} from "../../components/Theme/ThemeDesigner/types";
export type { DesignerVariables, HeadingStyle };
export interface CustomTheme {
  id: string;
  name: string;
  css: string;
  isBuiltIn: boolean;
  isSelectable?: boolean;
  createdAt: string;
  updatedAt: string;
  editorMode?: "visual" | "css";
  designerVariables?: DesignerVariables;
}
export interface ThemeDefinition {
  id: string;
  name: string;
  css: string;
}
export const isThemeSelectable = (theme: CustomTheme): boolean =>
  theme.isSelectable !== false;
const createdAt = new Date().toISOString();
export const builtInThemes: CustomTheme[] = builtInThemeCatalog.map(
  (theme) => ({
    id: theme.id,
    name: theme.name,
    css: theme.css,
    isBuiltIn: true,
    ...(theme.isSelectable ? {} : { isSelectable: false }),
    createdAt,
    updatedAt: createdAt,
  }),
);
export const defaultThemes: ThemeDefinition[] = builtInThemes
  .slice(0, 1)
  .map(({ id, name, css }) => ({ id, name, css }));
export function getDefaultThemeCSS(): string {
  return builtInThemes[0].css;
}
