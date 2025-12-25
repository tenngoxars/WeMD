// 可视化主题编辑器 - 预设选项配置

export interface StyleOption<T = string> {
  label: string;
  value: T;
  desc?: string;
}

// 字体选项
export const fontFamilyOptions: StyleOption[] = [
  {
    label: "无衬线",
    value: '-apple-system, BlinkMacSystemFont, "Microsoft YaHei", sans-serif',
    desc: "现代简洁",
  },
  {
    label: "衬线",
    value: 'Georgia, "Times New Roman", serif',
    desc: "优雅传统",
  },
  {
    label: "等宽",
    value: 'Menlo, Monaco, "Courier New", monospace',
    desc: "技术文档",
  },
];

// 字号选项
export const fontSizeOptions: StyleOption[] = [
  { label: "14px", value: "14px", desc: "紧凑" },
  { label: "15px", value: "15px", desc: "稍小" },
  { label: "16px", value: "16px", desc: "推荐" },
  { label: "17px", value: "17px", desc: "稍大" },
  { label: "18px", value: "18px", desc: "舒适" },
];

// 主题色预设
export const primaryColorOptions: StyleOption[] = [
  { label: "翡翠绿", value: "#07C160", desc: "微信绿" },
  { label: "活力橘", value: "#FA5151", desc: "热情活力" },
  { label: "天空蓝", value: "#55C9EA", desc: "清爽自由" },
  { label: "樱花粉", value: "#FF85C0", desc: "浪漫柔和" },
  { label: "薄荷绿", value: "#13C2C2", desc: "清新自然" },
  { label: "琥珀黄", value: "#FAAD14", desc: "明亮温暖" },
  { label: "极客蓝", value: "#1890FF", desc: "科技感" },
  { label: "酱紫", value: "#722ED1", desc: "高贵典雅" },
];

// 行高选项
export const lineHeightOptions: StyleOption[] = [
  { label: "1.5", value: "1.5", desc: "紧凑" },
  { label: "1.6", value: "1.6", desc: "适中" },
  { label: "1.7", value: "1.7", desc: "推荐" },
  { label: "1.8", value: "1.8", desc: "舒适" },
  { label: "2.0", value: "2.0", desc: "宽松" },
];

// 标题字号预设
export const headingSizePresets = {
  h1: { min: 20, max: 32, default: 24 },
  h2: { min: 18, max: 28, default: 20 },
  h3: { min: 16, max: 24, default: 18 },
  h4: { min: 14, max: 20, default: 16 },
};

// 边距预设范围
export const marginPresets = {
  min: 0,
  max: 60,
  step: 4,
};

// 标题样式预设
export interface HeadingPresetCss {
  content: string;
  extra?: string;
}

export interface HeadingPreset {
  id: string;
  label: string;
  cssTemplate: (color: string, tag: string) => HeadingPresetCss; // 接受主题色和标签（如 h1）
}

export const headingStylePresets: HeadingPreset[] = [
  {
    id: "simple",
    label: "简约",
    cssTemplate: () => ({ content: "" }),
  },
  {
    id: "left-border",
    label: "左侧竖线",
    cssTemplate: (color) => ({
      content: `
            border-left: 4px solid ${color};
            padding-left: 10px;
        `,
    }),
  },
  {
    id: "bottom-border",
    label: "底部下划线",
    cssTemplate: (color) => ({
      content: `
            border-bottom: 2px solid ${color};
            padding-bottom: 8px;
        `,
    }),
  },
  {
    id: "double-line",
    label: "双线装饰",
    cssTemplate: (color) => ({
      content: `
            border-top: 2px solid ${color};
            border-bottom: 2px solid ${color};
            padding: 8px 0;
        `,
    }),
  },
  {
    id: "boxed",
    label: "背景块",
    cssTemplate: (color) => ({
      content: `
            background: ${color}15;
            border-left: 4px solid ${color};
            padding: 8px 12px;
            border-radius: 4px;
        `,
    }),
  },
  {
    id: "bottom-highlight",
    label: "底部高亮",
    cssTemplate: (color) => ({
      content: `
            display: inline-block;
            background: linear-gradient(to bottom, transparent 60%, ${color}40 60%);
            padding: 0 4px;
        `,
    }),
  },
  {
    id: "pill",
    label: "高亮胶囊",
    cssTemplate: (color) => ({
      content: `
            background: ${color};
            color: #fff;
            padding: 4px 16px;
            border-radius: 20px;
            display: inline-block;
        `,
    }),
  },
  {
    id: "bracket",
    label: "括号装饰",
    cssTemplate: (color, tag) => ({
      content: `
            display: inline-block;
            position: relative;
            padding: 0 10px;
        `,
      extra: `
        #wemd ${tag} .content::before {
            content: '[';
            margin-right: 5px;
            color: ${color};
            font-weight: bold;
        }
        #wemd ${tag} .content::after {
            content: ']';
            margin-left: 5px;
            color: ${color};
            font-weight: bold;
        }
        `,
    }),
  },
];

export const boldStyleOptions = [
  { id: "none", label: "基础加粗" },
  { id: "color", label: "随主题色" },
  { id: "highlighter", label: "荧光笔" },
  { id: "highlighter-bottom", label: "底部涂抹" },
  { id: "underline", label: "下划线" },
  { id: "dot", label: "着重号" },
];

export interface QuotePresetCss {
  base: string;
  extra?: string;
}

export interface QuotePreset {
  id: string;
  label: string;
  cssTemplate: (
    color: string,
    bgColor: string,
    textColor: string,
  ) => QuotePresetCss;
}

export const quoteStylePresets: QuotePreset[] = [
  {
    id: "left-border",
    label: "经典竖线",
    cssTemplate: (color, bgColor, textColor) => ({
      base: `
            border-left: 4px solid ${color};
            background: ${bgColor};
            padding: 12px 16px;
            color: ${textColor};
            margin: 20px 0;
        `,
    }),
  },
  {
    id: "top-bottom-border",
    label: "上下双线",
    cssTemplate: (color, bgColor, textColor) => ({
      base: `
            border-top: 1px solid ${color};
            border-bottom: 1px solid ${color};
            background: ${bgColor};
            padding: 20px 16px;
            color: ${textColor};
            text-align: center;
            margin: 20px 0;
        `,
      extra: `
        #wemd blockquote p { text-align: center !important; }
        `,
    }),
  },
  {
    id: "quotation-marks",
    label: "大引号",
    cssTemplate: (color, bgColor, textColor) => ({
      base: `
            background: ${bgColor};
            padding: 25px 20px;
            color: ${textColor};
            position: relative;
            border-radius: 4px;
            margin: 20px 0;
        `,
      extra: `
        #wemd blockquote::before {
            content: "“";
            position: absolute;
            top: 5px;
            left: 10px;
            font-size: 40px;
            color: ${color}40;
            font-family: Georgia, serif;
            line-height: 1;
        }
        `,
    }),
  },
  {
    id: "boxed",
    label: "极简边框",
    cssTemplate: (color, bgColor, textColor) => ({
      base: `
            border: 1px solid ${color}40;
            background: ${bgColor};
            padding: 16px;
            color: ${textColor};
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.03);
            margin: 20px 0;
        `,
    }),
  },
  {
    id: "center-accent",
    label: "中心强调",
    cssTemplate: (color, bgColor, textColor) => ({
      base: `
            background: transparent;
            padding: 30px 0;
            color: ${textColor};
            text-align: center;
            margin: 20px 0;
            position: relative;
        `,
      extra: `
        #wemd blockquote p { text-align: center !important; }
        #wemd blockquote::before {
            content: "";
            display: block;
            width: 40px;
            height: 2px;
            background: ${color};
            margin: 0 auto 15px;
            opacity: 0.8;
        }
        #wemd blockquote::after {
            content: "";
            display: block;
            width: 40px;
            height: 2px;
            background: ${color};
            margin: 15px auto 0;
            opacity: 0.8;
        }
        `,
    }),
  },
];

// 无序列表样式选项
export const ulStyleOptions: StyleOption[] = [
  { label: "实心圆点", value: "disc" },
  { label: "空心圆点", value: "circle" },
  { label: "实心正方形", value: "square" },
  { label: "无", value: "none" },
];

// 有序列表样式选项
export const olStyleOptions: StyleOption[] = [
  { label: "数字 (1, 2, 3)", value: "decimal" },
  { label: "字母 (a, b, c)", value: "lower-alpha" },
  { label: "罗马数字 (i, ii, iii)", value: "lower-roman" },
  { label: "中文数字", value: "cjk-ideographic" },
];

export const inlineCodeStyleOptions = [
  { id: "simple", label: "基础" },
  { id: "rounded", label: "圆角" },
  { id: "github", label: "GitHub 风格" },
  { id: "color-text", label: "着色文字" },
];

export const codeBlockThemeOptions = [
  { id: "github", label: "GitHub Light" },
  { id: "monokai", label: "Monokai" },
  { id: "vscode", label: "Atom One Dark" },
  { id: "night-owl", label: "Night Owl" },
];

// 8 大分类定义
export type StyleCategory =
  | "global"
  | "heading"
  | "paragraph"
  | "quote"
  | "list"
  | "code"
  | "image"
  | "table";

export interface CategoryConfig {
  id: StyleCategory;
  label: string;
  icon: string;
  description: string;
}

export const styleCategories: CategoryConfig[] = [
  { id: "global", label: "全局", icon: "🎨", description: "字体、主色调" },
  { id: "heading", label: "标题", icon: "H", description: "H1-H4 样式" },
  { id: "paragraph", label: "正文", icon: "¶", description: "段落样式" },
  { id: "quote", label: "引用", icon: "❝", description: "引用块样式" },
  { id: "list", label: "列表", icon: "☰", description: "列表样式" },
  { id: "code", label: "代码", icon: "</>", description: "代码块样式" },
  { id: "image", label: "图片", icon: "🖼", description: "图片样式" },
  { id: "table", label: "表格", icon: "田", description: "表格样式" },
];
