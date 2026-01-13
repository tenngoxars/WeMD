export const neoBrutalismTheme = `/* 新粗野主义风格 */
#wemd {
    padding: 5px 22px;
    max-width: 677px;
    margin: 0 auto;
    font-family: -apple-system, "Helvetica Neue", "PingFang SC", "Microsoft YaHei", sans-serif;
    color: #000;
    /* 纯黑文字，极致对比 */
    /* 透明背景，兼容微信深色模式 */
    background-color: transparent;
    word-break: break-word;
}

/* 段落 - 高对比度 */
#wemd p {
    margin-top: 24px;
    margin-bottom: 24px;
    line-height: 1.8;
    letter-spacing: 0.5px;
    text-align: justify;
    color: #111;
    font-size: 16px;
    font-weight: 400;
}

/* 
 * 一级标题 - 像一个醒目的标签盒子
 * 设计：粗边框 + 荧光黄背景 + 硬阴影
 */
#wemd h1 {
    margin-top: 60px;
    margin-bottom: 50px;
    text-align: center;
}

#wemd h1 .content {
    display: inline-block;
    font-size: 24px;
    font-weight: 900;
    color: #000;
    background-color: #CCFF00;
    /* 荧光黄高亮 */
    border: 3px solid #000;
    /* 粗黑边框 */
    padding: 12px 20px;
    /* 关键：黑色硬阴影 */
    box-shadow: 6px 6px 0px #000;
    line-height: 1.3;
}

#wemd h1 .prefix,
#wemd h1 .suffix {
    display: none;
}

/* 
 * 二级标题 - 下划线高亮
 * 设计：文字下方的厚实色块
 */
#wemd h2 {
    margin-top: 60px;
    margin-bottom: 30px;
    text-align: left;
    border-bottom: 3px solid #000;
    /* 通栏粗黑线 */
    padding-bottom: 10px;
}

#wemd h2 .content {
    display: inline-block;
    font-size: 20px;
    font-weight: 800;
    color: #fff;
    background-color: #6A00FF;
    /* 电光紫背景 */
    padding: 8px 16px;
    border: 2px solid #000;
    /* 左上偏移的阴影效果 */
    box-shadow: 4px -4px 0px #000;
    line-height: 1.2;
}

#wemd h2 .prefix,
#wemd h2 .suffix {
    display: none;
}

/* 
 * 三级标题 - 几何引导
 */
#wemd h3 {
    margin-top: 40px;
    margin-bottom: 20px;
}

#wemd h3 .content {
    display: inline-block;
    font-size: 18px;
    font-weight: 800;
    color: #000;
    padding-left: 12px;
    border-left: 8px solid #CCFF00;
    /* 极粗的黄线 */
    line-height: 1.2;
}

#wemd h3 .prefix,
#wemd h3 .suffix {
    display: none;
}

/* 
 * 四级标题 - 反色黑盒
 */
#wemd h4 {
    margin-top: 30px;
    margin-bottom: 15px;
    text-align: left;
}

#wemd h4 .content {
    display: inline-block;
    font-size: 16px;
    font-weight: 700;
    color: #fff;
    background-color: #000;
    /* 纯黑背景 */
    padding: 6px 12px;
    border-radius: 0;
    /* 直角 */
    line-height: 1.4;
}

#wemd h4 .prefix,
#wemd h4 .suffix {
    display: none;
}

/* 
 * 列表 - 强烈的几何感
 * 必须使用正方形
 */
#wemd ul {
    list-style-type: square;
    padding-left: 20px;
    margin: 20px 0;
    color: #6A00FF;
    /* 紫色方块 */
}

#wemd ul li {
    margin-bottom: 12px;
    line-height: 1.75;
}

#wemd li section {
    color: #000;
    font-size: 16px;
    font-weight: 500;
}

/* 有序列表 - 粗黑体数字 */
#wemd ol {
    list-style-type: decimal;
    padding-left: 20px;
    margin: 20px 0;
    color: #000;
    font-weight: 900;
    /* 最粗字体 */
}

#wemd ol li {
    margin-bottom: 12px;
    line-height: 1.75;
    border-bottom: 1px solid #eee;
    /* 增加分割线 */
    padding-bottom: 8px;
}

#wemd ol li section {
    color: #222;
    font-weight: normal;
    font-size: 16px;
    padding-left: 5px;
}

#wemd ul ul {
    list-style-type: circle;
    color: #CCFF00;
    margin-top: 10px;
}

#wemd ol ol {
    list-style-type: upper-alpha;
    color: #6A00FF;
    font-weight: 900;
}

/* 
 * 引用 - 视窗风格 (Window Style)
 * 这是一个带粗边框和硬阴影的盒子
 */
#wemd .multiquote-1,
#wemd .multiquote-2,
#wemd .multiquote-3 {
    margin: 40px 0;
    padding: 24px;
    background-color: #f4f4f4;
    /* 浅灰背景 */
    border: 2px solid #000;
    /* 粗黑边框 */
    /* 经典的波普风硬阴影 */
    box-shadow: 6px 6px 0px #6A00FF;
    overflow: visible !important;
}

#wemd .multiquote-1 p,
#wemd .multiquote-2 p,
#wemd .multiquote-3 p {
    margin: 0;
    color: #000;
    font-size: 15px;
    line-height: 1.8;
    font-weight: 500;
}

#wemd .multiquote-2 {
    margin: 38px 0;
    padding: 22px;
    background: #fff;
    border: 2px solid #000;
    box-shadow: 5px 5px 0px #CCFF00;
}

#wemd .multiquote-3 {
    margin: 36px 0;
    padding: 20px;
    background: #fafafa;
    border: 2px solid #000;
    box-shadow: 4px 4px 0px #FF6B9D;
}

/* 链接 - 荧光笔涂抹效果 */
#wemd a {
    color: #000;
    /* 链接文字黑色 */
    text-decoration: none;
    border-bottom: 2px solid #000;
    background: linear-gradient(180deg, transparent 60%, #CCFF00 0);
    /* 下半部分黄色高亮 */
    font-weight: 700;
    padding: 0 2px;
    transition: all 0.2s;
}

/* 
 * 加粗 - 故障风效果
 * 紫色背景 + 白字
 */
#wemd strong {
    color: #fff;
    background-color: #6A00FF;
    font-weight: 700;
    padding: 2px 6px;
    margin: 0 2px;
    border: 1px solid #000;
    /* 加个细黑边 */
}

/* 斜体 */
#wemd em {
    color: #6A00FF;
    font-style: italic;
    font-weight: bold;
}

#wemd em strong {
    color: #fff;
}

/* 高亮 - 荧光黄块 */
#wemd mark {
    background: #CCFF00;
    color: #000;
    padding: 2px 6px;
    border: 2px solid #000;
    font-weight: bold;
}

/* 删除线 - 粗线 */
#wemd del {
    text-decoration: line-through;
    text-decoration-thickness: 3px;
    text-decoration-color: #FF6B9D;
    color: #666;
}

/* 分隔线 - 粗黑条 */
#wemd hr {
    margin: 60px auto;
    border: 0;
    height: 4px;
    background: #000;
    width: 100%;
}

/* 
 * 图片 - 拍立得效果
 * 粗框 + 硬阴影
 */
#wemd img {
    display: block;
    margin: 40px auto;
    width: 100%;
    border: 2px solid #000;
    box-shadow: 8px 8px 0px #000;
    /* 纯黑硬阴影 */
    padding: 0;
    background: #fff;
}

/* 针对图片下方的注释文字 */
#wemd figcaption {
    margin-top: 12px;
    text-align: center;
    color: #000;
    font-size: 14px;
    font-weight: bold;
    background: #CCFF00;
    padding: 4px 10px;
    border: 2px solid #000;
    display: inline-block;
    box-shadow: 3px 3px 0 #000;
}

/* 行内代码 - 复古终端风 */
#wemd p code,
#wemd li code {
    color: #000;
    background: #fff;
    border: 1px solid #000;
    padding: 2px 6px;
    margin: 0 4px;
    font-size: 14px;
    font-family: "Menlo", monospace;
    font-weight: bold;
    box-shadow: 2px 2px 0 #ccc;
}

/* 代码块 - 纯黑硬核模式 */
/* 代码块 - 注意：不要设置 color，让语法高亮主题控制文字颜色 */
#wemd pre code.hljs {
    display: block;
    padding: 16px;
    background: #000;
    /* 纯黑 */
    color: #CCFF00;
    /* 默认荧光绿文字 */
    font-size: 13px;
    line-height: 1.5;
    border-radius: 0;
    /* 直角 */
    font-family: "Menlo", "Courier New", monospace;
    overflow-x: auto;
    white-space: pre;
  min-width: max-content;
    border: 2px solid #000;
    box-shadow: 6px 6px 0px #ddd;
}

/* 优化深色背景下的语法高亮颜色 - 使用高对比度亮色 */
#wemd pre code.hljs .hljs-comment,
#wemd pre code.hljs .hljs-quote {
    color: #888;
}

#wemd pre code.hljs .hljs-keyword,
#wemd pre code.hljs .hljs-selector-tag {
    color: #FF6B9D;
    font-weight: bold;
}

#wemd pre code.hljs .hljs-string,
#wemd pre code.hljs .hljs-doctag {
    color: #FFD93D;
}

#wemd pre code.hljs .hljs-number,
#wemd pre code.hljs .hljs-literal {
    color: #6BCF7F;
}

#wemd pre code.hljs .hljs-title,
#wemd pre code.hljs .hljs-section {
    color: #4D9DE0;
    font-weight: bold;
}

#wemd pre code.hljs .hljs-built_in,
#wemd pre code.hljs .hljs-builtin-name {
    color: #E85D75;
    font-weight: bold;
}

/* 如果没有语法高亮，设置默认荧光绿 */
#wemd pre code:not(.hljs) {
    color: #CCFF00;
    background: #000;
    border: 2px solid #000;
    box-shadow: 6px 6px 0px #ddd;
}

/* 表格 - Excel 粗框风格 */
#wemd table {
    width: 100%;
    border-collapse: collapse;
    margin: 40px 0;
    font-size: 14px;
    border: 2px solid #000;
    box-shadow: 6px 6px 0px #000;
}

#wemd table tr th {
    background: #6A00FF;
    /* 紫色表头 */
    color: #fff;
    font-weight: 900;
    border: 1px solid #000;
    padding: 12px;
    text-align: left;
    text-transform: uppercase;
}

#wemd table tr td {
    border: 1px solid #000;
    padding: 12px;
    color: #000;
    background: #fff;
}

/* 隔行变色 - 黄色 */
#wemd table tr:nth-child(even) td {
    background-color: #faffd1;
}

/* 脚注 */
#wemd .footnote-word,
#wemd .footnote-ref {
    color: #6A00FF;
    font-weight: bold;
}

#wemd .footnotes-sep {
    border-top: 2px solid #000;
    padding-top: 20px;
    margin-top: 60px;
    font-size: 14px;
    font-weight: 900;
    color: #000;
    text-transform: uppercase;
}

#wemd .footnote-num {
    font-weight: 900;
    color: #fff;
    background: #000;
    padding: 1px 4px;
    margin-right: 4px;
    font-size: 12px;
}

#wemd .footnote-item p {
    color: #333;
    font-size: 12px;
    margin: 4px 0;
}

/* 公式 */
#wemd .block-equation svg {
    max-width: 100% !important;
}

#wemd .inline-equation svg {
    max-width: 100%;
    vertical-align: middle;
}

/* 提示块 - 新粗野主义风格 */
#wemd .callout {
    margin: 40px 0;
    padding: 20px;
    background: #f4f4f4;
    border: 2px solid #000;
    box-shadow: 6px 6px 0px #6A00FF;
    border-radius: 0;
}

#wemd .callout-title {
    font-weight: 900;
    margin-bottom: 10px;
    text-transform: uppercase;
    color: #000;
    font-size: 16px;
}

#wemd .callout-icon { margin-right: 8px;
    margin-right: 6px;
}

#wemd .callout-note { border-left: 8px solid #6A00FF; }
#wemd .callout-tip { border-left: 8px solid #CCFF00; }
#wemd .callout-important { border-left: 8px solid #6A00FF; }
#wemd .callout-warning { border-left: 8px solid #CCFF00; }
#wemd .callout-caution { border-left: 8px solid #FF6B9D; }

/* Imageflow CSS */
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
