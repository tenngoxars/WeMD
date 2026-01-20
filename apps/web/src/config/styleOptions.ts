function expandHexColor(color: string): string {
  if (color.length === 4 && color.startsWith("#")) {
    return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
  }
  return color;
}

export interface StyleOption<T = string> {
  label: string;
  value: T;
  desc?: string;
}

export const fontFamilyOptions: StyleOption[] = [
  {
    label: "无衬线",
    value:
      "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif",
    desc: "现代简洁",
  },
  {
    label: "衬线",
    value:
      "Optima-Regular, Optima, '宋体', 'Songti SC', 'Noto Serif SC', SimSun, STSong, 'Times New Roman', serif",
    desc: "优雅传统",
  },
  {
    label: "等宽",
    value: "Menlo, Monaco, Consolas, 'Courier New', monospace",
    desc: "技术文档",
  },
];

export const fontSizeOptions: StyleOption[] = [
  { label: "14px", value: "14px", desc: "紧凑" },
  { label: "15px", value: "15px", desc: "稍小" },
  { label: "16px", value: "16px", desc: "推荐" },
  { label: "17px", value: "17px", desc: "稍大" },
  { label: "18px", value: "18px", desc: "舒适" },
];

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

export const lineHeightOptions: StyleOption[] = [
  { label: "1.5", value: "1.5", desc: "紧凑" },
  { label: "1.6", value: "1.6", desc: "适中" },
  { label: "1.7", value: "1.7", desc: "推荐" },
  { label: "1.8", value: "1.8", desc: "舒适" },
  { label: "2.0", value: "2.0", desc: "宽松" },
];

export const headingSizePresets = {
  h1: { min: 20, max: 32, default: 24 },
  h2: { min: 18, max: 28, default: 20 },
  h3: { min: 16, max: 24, default: 18 },
  h4: { min: 14, max: 20, default: 16 },
};

export const marginPresets = {
  min: 0,
  max: 60,
  step: 4,
};

export interface HeadingPresetCss {
  content: string;
  extra?: string;
}

export interface HeadingPreset {
  id: string;
  label: string;
  cssTemplate: (color: string, tag: string) => HeadingPresetCss;
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
    borderWidth: number,
    borderStyle: string,
    padding: number,
    centered?: boolean,
  ) => QuotePresetCss;
}

export const quoteStylePresets: QuotePreset[] = [
  {
    id: "left-border",
    label: "经典竖线",
    cssTemplate: (
      _color,
      bgColor,
      _textColor,
      borderWidth,
      borderStyle,
      _padding,
      _centered,
    ) => ({
      base: `
            background: ${bgColor};
            border-left-style: ${borderStyle};
            border-left-width: ${borderWidth}px;
        `,
    }),
  },
  {
    id: "top-bottom-border",
    label: "上下双线",
    cssTemplate: (
      color,
      bgColor,
      _textColor,
      borderWidth,
      borderStyle,
      _padding,
      _centered,
    ) => ({
      base: `
            border-top: ${borderWidth}px ${borderStyle} ${color};
            border-bottom: ${borderWidth}px ${borderStyle} ${color};
            border-left: none !important;
            background: ${bgColor};
            text-align: center;
        `,
      extra: `
        #wemd blockquote p { text-align: center !important; }
        `,
    }),
  },
  {
    id: "quotation-marks",
    label: "大引号",
    cssTemplate: (
      color,
      bgColor,
      _textColor,
      _borderWidth,
      _borderStyle,
      padding,
      _centered,
    ) => {
      const c = expandHexColor(color);

      // 基础 padding + 40px 用于避让引号
      const leftPadding = (padding || 20) + 40;

      return {
        base: `
            background: ${bgColor};
            border-left: none !important;
            border-radius: 4px;
            padding-left: ${leftPadding}px !important;
        `,
        extra: `
        #wemd blockquote::before {
            content: "“";
            display: block;
            height: 0;
            font-size: 60px;
            color: ${c};
            font-family: Georgia, serif;
            line-height: 1;
            margin-left: -40px;
            margin-top: -6px;
            opacity: 0.3;
            pointer-events: none;
        }
        #wemd blockquote p {
            position: relative;
            z-index: 1;
        }
        `,
      };
    },
  },
  {
    id: "boxed",
    label: "极简边框",
    cssTemplate: (
      color,
      bgColor,
      _textColor,
      borderWidth,
      borderStyle,
      _padding,
      _centered,
    ) => {
      const c = expandHexColor(color);
      return {
        base: `
            border: ${borderWidth}px ${borderStyle} ${c}40;
            border-left: ${borderWidth}px ${borderStyle} ${c}40 !important;
            background: ${bgColor};
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.03);
        `,
      };
    },
  },
  {
    id: "center-accent",
    label: "中心强调",
    cssTemplate: (
      color,
      _bgColor,
      _textColor,
      borderWidth,
      _borderStyle,
      _padding,
      _centered,
    ) => ({
      base: `
            background: transparent;
            border-left: none !important;
            text-align: center;
            position: relative;
        `,
      extra: `
        #wemd blockquote p { text-align: center !important; }
        #wemd blockquote::before {
            content: "";
            display: block;
            width: 40px;
            height: ${borderWidth}px;
            background: ${color};
            margin: 0 auto 15px;
            opacity: 0.8;
        }
        #wemd blockquote::after {
            content: "";
            display: block;
            width: 40px;
            height: ${borderWidth}px;
            background: ${color};
            margin: 15px auto 0;
            opacity: 0.8;
        }
        `,
    }),
  },
  {
    id: "corner-frame",
    label: "直角边框",
    cssTemplate: (
      color,
      bgColor,
      _textColor,
      borderWidth,
      borderStyle,
      _padding,
      _centered,
    ) => {
      const c = expandHexColor(color);
      return {
        base: `
            background: ${bgColor};
            border-left: none !important;
            position: relative;
            position: relative;
        `,
        extra: `
        #wemd blockquote::before {
            content: "";
            position: absolute;
            top: 0;
            left: 0;
            width: 20px;
            height: 20px;
            border-top: ${borderWidth}px ${borderStyle} ${c};
            border-left: ${borderWidth}px ${borderStyle} ${c};
        }
        #wemd blockquote::after {
            content: "";
            position: absolute;
            bottom: 0;
            right: 0;
            width: 20px;
            height: 20px;
            border-bottom: ${borderWidth}px ${borderStyle} ${c};
            border-right: ${borderWidth}px ${borderStyle} ${c};
        }
        `,
      };
    },
  },
];

export const ulStyleOptions: StyleOption[] = [
  { label: "实心圆点", value: "disc" },
  { label: "空心圆点", value: "circle" },
  { label: "实心正方形", value: "square" },
  { label: "无", value: "none" },
];

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
  { id: "dracula", label: "Dracula" },
  { id: "solarized-dark", label: "Solarized Dark" },
  { id: "solarized-light", label: "Solarized Light" },
  { id: "xcode", label: "Xcode" },
  { id: "atom-one-light", label: "Atom One Light" },
];

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
