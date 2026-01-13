export const templateTheme = `/*
 * ============================================
 * WeMD 主题模板
 * ============================================
 * 
 * 使用说明：
 * 1. 修改下方的样式定义，创建你的自定义主题
 * 2. 所有选择器必须以 #wemd 开头
 * 3. 代码块使用 #wemd pre code.hljs，不要设置全局 color
 * 
 * ============================================
 * 🌙 深色模式说明（微信兼容）
 * ============================================
 * 
 * ✅ 支持自动转换的颜色格式：
 *   - HEX: #333333, #fff
 *   - RGB: rgb(51, 51, 51), rgba(0, 0, 0, 0.5)
 *   - HSL: hsl(0, 0%, 20%), hsla(0, 0%, 0%, 0.5)
 *   - 渐变: linear-gradient(), radial-gradient() 中的色值
 * 
 * 🔄 智能转换规则（色彩语义保全）：
 *   - 灰度背景 → 映射到深色区间 (10%-20% 亮度)
 *   - 高饱和色彩 (S>15%) → 保持鲜艳，亮度钳制在 35%-55%
 *   - 深色阴影/边框 (L<20) → 锚定为暗色，不反转
 *   - 文字颜色 → 动态对比度调整以保证可读性
 * 
 * ⚠️ 不会被转换：
 *   - CSS 变量: var(--xxx)
 *   - 图片: url()
 *   - 颜色名称: white, black（请使用 HEX 格式）
 * 
 * 💡 设计建议：
 *   - 背景色用透明或浅灰，利于自动适配
 *   - 彩色装饰保持原值，算法自动保护
 *   - 深色投影和粗边框使用纯黑 #000，可保持层级感
 */

/* ============================================
 * 1. 全局容器样式
 * ============================================
 */
#wemd {
    padding: 30px 20px;
    max-width: 677px;
    margin: 0 auto;
    font-family: -apple-system, BlinkMacSystemFont, "Microsoft YaHei", sans-serif;
    color: #333;
    background-color: transparent;
    /* 透明背景，兼容微信深色模式 */
    word-break: break-word;
}

/* ============================================
 * 2. 段落样式
 * ============================================
 */
#wemd p {
    margin: 16px 0;
    /* 段落间距：上下各 16px */
    line-height: 1.7;
    /* 行高：1.7 倍，舒适阅读 */
    text-align: justify;
    /* 文本对齐：两端对齐 */
    color: #333;
    /* 文字颜色 */
    font-size: 16px;
    /* 字体大小 */
}

/* ============================================
 * 3. 标题样式
 * ============================================
 * 注意：标题内部结构为：
 * <h1>
 *   <span class="prefix"></span>
 *   <span class="content">标题文字</span>
 *   <span class="suffix"></span>
 * </h1>
 * 
 * 可以通过 .prefix 和 .suffix 添加装饰元素
 */

/* 一级标题 */
#wemd h1 {
    margin: 40px 0 30px;
    /* 外边距：上 40px，下 30px */
    text-align: center;
    /* 居中对齐 */
}

#wemd h1 .content {
    font-size: 24px;
    /* 字体大小 */
    font-weight: bold;
    /* 字体粗细：加粗 */
    color: #000;
    /* 文字颜色 */
}

/* 隐藏前缀和后缀（如果不需要装饰） */
#wemd h1 .prefix,
#wemd h1 .suffix {
    display: none;
}

/* 二级标题 */
#wemd h2 {
    margin: 30px 0 20px;
}

#wemd h2 .content {
    font-size: 20px;
    font-weight: bold;
    color: #333;
}

#wemd h2 .prefix,
#wemd h2 .suffix {
    display: none;
}

/* 三级标题 */
#wemd h3 {
    margin: 25px 0 15px;
}

#wemd h3 .content {
    font-size: 18px;
    font-weight: bold;
    color: #666;
}

#wemd h3 .prefix,
#wemd h3 .suffix {
    display: none;
}

/* 四级标题 */
#wemd h4 {
    margin: 20px 0 10px;
}

#wemd h4 .content {
    font-size: 16px;
    font-weight: bold;
    color: #666;
}

#wemd h4 .prefix,
#wemd h4 .suffix {
    display: none;
}

/* ============================================
 * 4. 引用样式
 * ============================================
 * 支持多级引用：.multiquote-1, .multiquote-2, .multiquote-3
 */
#wemd .multiquote-1 {
    margin: 20px 0;
    /* 外边距 */
    padding: 16px 20px;
    /* 内边距 */
    background: #f5f5f5;
    /* 背景色 */
    border-left: 4px solid #ddd;
    /* 左边框 */
    border-radius: 4px;
    /* 圆角 */
}

#wemd .multiquote-1 p {
    margin: 0;
    /* 段落无外边距 */
    color: #666;
    /* 文字颜色 */
    font-size: 15px;
}

/* 二级引用 */
#wemd .multiquote-2 {
    margin: 18px 0;
    padding: 14px 18px;
    background: #fafafa;
    border-left: 3px solid #ccc;
}

#wemd .multiquote-2 p {
    margin: 0;
    color: #777;
    font-size: 14px;
}

/* 三级引用 */
#wemd .multiquote-3 {
    margin: 16px 0;
    padding: 12px 16px;
    background: #fafafa;
    border-left: 2px solid #bbb;
}

#wemd .multiquote-3 p {
    margin: 0;
    color: #888;
    font-size: 14px;
}

/* ============================================
 * 5. 列表样式
 * ============================================
 */
#wemd ul,
#wemd ol {
    margin: 15px 0;
    padding-left: 25px;
    /* 左内边距，为列表符号留空间 */
}

#wemd ul {
    list-style-type: disc;
    /* 无序列表：实心圆点 */
}

#wemd ol {
    list-style-type: decimal;
    /* 有序列表：数字 */
}

/* 列表项内容
 * 注意：列表项内部使用 <section> 包裹内容
 */
#wemd li section {
    margin: 5px 0;
    /* 列表项间距 */
    color: #333;
    /* 文字颜色 */
    line-height: 1.6;
}

#wemd ul ul {
    list-style-type: circle;
    margin-top: 6px;
}

#wemd ol ol {
    list-style-type: lower-alpha;
}

/* ============================================
 * 6. 链接样式
 * ============================================
 */
#wemd a {
    color: #1e6bb8;
    /* 链接颜色 */
    text-decoration: none;
    /* 去除下划线 */
    border-bottom: 1px solid #1e6bb8;
    /* 底部边框作为下划线 */
    font-weight: bold;
    /* 加粗 */
}

/* ============================================
 * 7. 文本样式
 * ============================================
 */
/* 加粗 */
#wemd strong {
    font-weight: bold;
    color: #000;
}

/* 斜体 */
#wemd em {
    font-style: italic;
    color: #333;
}

/* 加粗斜体 */
#wemd em strong {
    font-weight: bold;
    font-style: italic;
    color: #000;
}

/* 高亮 */
#wemd mark {
    background: #fff3cd;
    color: #000;
    padding: 2px 4px;
    border-radius: 3px;
}

/* 删除线 */
#wemd del {
    text-decoration: line-through;
    color: #999;
}

/* ============================================
 * 8. 行内代码样式
 * ============================================
 * 注意：行内代码在段落和列表项中
 */
#wemd p code,
#wemd li code {
    color: #e83e8c;
    /* 文字颜色 */
    background: #f8f9fa;
    /* 背景色 */
    padding: 2px 6px;
    /* 内边距 */
    margin: 0 2px;
    /* 外边距 */
    border-radius: 3px;
    /* 圆角 */
    font-size: 14px;
    font-family: "Courier New", Courier, monospace;
    /* 等宽字体 */
}

/* ============================================
 * 9. 代码块样式（重要！）
 * ============================================
 * 
 * ⚠️ 重要提示：
 * 1. 必须使用 #wemd pre code.hljs 选择器，不要使用 #wemd pre code
 * 2. 不要设置全局 color 属性，让语法高亮主题控制文字颜色
 * 3. 如果设置了 color，会覆盖语法高亮的颜色，导致代码看不清
 * 4. 使用 #wemd pre code:not(.hljs) 作为后备样式（无语法高亮时）
 * 
 * 示例（正确）：
 * #wemd pre code.hljs {
 *     background: #f5f5f5;
 *     // 不设置 color
 * }
 * 
 * 示例（错误）：
 * #wemd pre code {
 *     color: #333;  // ❌ 这会覆盖语法高亮
 * }
 */
#wemd pre code.hljs {
    display: block;
    padding: 16px;
    /* 内边距 */
    background: #f5f5f5;
    /* 背景色 */
    /* ⚠️ 注意：不要在这里设置 color，让语法高亮主题控制 */
    font-size: 13px;
    line-height: 1.6;
    border-radius: 4px;
    /* 圆角 */
    font-family: "Courier New", "Consolas", "Monaco", monospace;
    /* 等宽字体 */
    overflow-x: auto;
    /* 横向滚动 */
    white-space: pre;
  min-width: max-content;
    /* 保留空白和换行 */
    border: 1px solid #ddd;
    /* 边框 */
}

/* 如果没有语法高亮，设置默认样式 */
#wemd pre code:not(.hljs) {
    color: #333;
    /* 默认文字颜色 */
    background: #f5f5f5;
    border: 1px solid #ddd;
}

/* ============================================
 * 10. 图片样式
 * ============================================
 */
#wemd img {
    display: block;
    /* 块级元素 */
    margin: 20px auto;
    /* 居中：上下 20px，左右自动 */
    max-width: 100%;
    /* 最大宽度：不超出容器 */
    border-radius: 4px;
    /* 圆角 */
}

/* 图片容器（figure） */
#wemd figure {
    margin: 20px 0;
    text-align: center;
}

/* 图片说明文字（figcaption） */
#wemd figcaption {
    margin-top: 8px;
    color: #999;
    font-size: 14px;
}

/* ============================================
 * 11. 表格样式
 * ============================================
 */
#wemd table {
    width: 100%;
    /* 宽度：100% */
    border-collapse: collapse;
    /* 边框合并 */
    margin: 20px 0;
    /* 外边距 */
    font-size: 14px;
}

/* 表头 */
#wemd table tr th {
    background: #f5f5f5;
    /* 背景色 */
    color: #333;
    border: 1px solid #ddd;
    /* 边框 */
    padding: 10px;
    /* 内边距 */
    font-weight: bold;
    /* 加粗 */
    text-align: left;
}

/* 表格单元格 */
#wemd table tr td {
    border: 1px solid #ddd;
    padding: 10px;
    color: #333;
}

/* 斑马纹（隔行变色） */
#wemd table tr:nth-child(even) td {
    background-color: #fafafa;
}

/* ============================================
 * 12. 分割线样式
 * ============================================
 */
#wemd hr {
    margin: 30px 0;
    /* 外边距 */
    border: none;
    /* 去除默认边框 */
    border-top: 1px solid #ddd;
    /* 顶部边框 */
    height: 1px;
}

/* ============================================
 * 13. 脚注样式
 * ============================================
 */
#wemd .footnote-word,
#wemd .footnote-ref {
    color: #1e6bb8;
    /* 脚注链接颜色 */
    font-weight: bold;
}

#wemd .footnotes-sep {
    border-top: 1px solid #ddd;
    /* 分隔线 */
    padding-top: 20px;
    margin-top: 40px;
}

#wemd .footnote-num {
    font-weight: bold;
    color: #1e6bb8;
    margin-right: 4px;
}

#wemd .footnote-item p {
    color: #666;
    font-size: 14px;
    margin: 4px 0;
}

/* ============================================
 * 14. 数学公式样式
 * ============================================
 */
/* 行间公式 */
#wemd .block-equation {
    display: block;
    text-align: center;
    margin: 20px 0;
    overflow-x: auto;
}

#wemd .block-equation svg {
    max-width: 100% !important;
    /* 最大宽度：不超出容器 */
}

/* 行内公式 */
#wemd .inline-equation {
    display: inline;
}

#wemd .inline-equation svg {
    max-width: 100%;
    vertical-align: middle;
    /* 垂直居中 */
}

/* ============================================
 * 16. 提示块样式（Callout）
 * ============================================
 * 
 * 提示块用于显示不同类型的提示信息
 * 支持的类型：note、info、tip、success、warning、danger
 */

/* 提示块基础样式 */
#wemd .callout {
    margin: 20px 0;
    padding: 16px 20px;
    background: #f5f5f5;
    border-left: 4px solid #ddd;
    border-radius: 4px;
}

#wemd .callout-title {
    font-weight: bold;
    margin-bottom: 8px;
    color: #333;
    font-size: 15px;
}

#wemd .callout-icon { margin-right: 8px;
    margin-right: 6px;
}

/* 不同类型的提示块 */
#wemd .callout-note { 
    border-left-color: #6366f1; 
    background: #f5f5ff; 
}

#wemd .callout-tip { 
    border-left-color: #10b981; 
    background: #ecfdf5; 
}

#wemd .callout-important { 
    border-left-color: #8b5cf6; 
    background: #f5f3ff; 
}

#wemd .callout-warning { 
    border-left-color: #f59e0b; 
    background: #fffbeb; 
}

#wemd .callout-caution { 
    border-left-color: #ef4444; 
    background: #fff5f5; 
}

/* ============================================
 * 15. 其他元素
 * ============================================
 */
/* 定义列表 */
#wemd dl {
    margin: 15px 0;
}

#wemd dt {
    font-weight: bold;
    margin-top: 10px;
}

#wemd dd {
    margin-left: 20px;
    color: #666;
}

/* 目录（TOC） */
#wemd .table-of-contents {
    margin: 20px 0;
    padding: 15px;
    background: #f5f5f5;
    border-left: 3px solid #ddd;
    border-radius: 4px;
}

#wemd .table-of-contents a {
    color: #333;
    text-decoration: none;
}




/* ============================================
 * 17. 图片轮播样式 (Imageflow)
 * ============================================
 */
#wemd .imageflow-layer1 {
  margin-top: 1em;
  margin-bottom: 0.5em;
  /* white-space: normal; */
  border: 0px none;
  padding: 0px;
  overflow: hidden;
}

#wemd .imageflow-layer2 {
  white-space: nowrap;
  width: 100%;
  overflow-x: scroll;
}

#wemd .imageflow-layer3 {
  display: inline-block;
  word-wrap: break-word;
  white-space: normal;
  vertical-align: top;
  width: 80%;
  margin-right: 10px;
  flex-shrink: 0;
}

#wemd .imageflow-img {
  display: block;
  width: 100%;
  height: auto;
  max-height: 300px;
  object-fit: contain;
  border-radius: 4px;
}

#wemd .imageflow-caption {
  text-align: center;
  margin-top: 0px;
  padding-top: 0px;
  color: #888;
}
`;
