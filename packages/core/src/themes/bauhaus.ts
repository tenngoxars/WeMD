export const bauhausTheme = `/* 包豪斯风格 */
#wemd {
    padding: 30px 22px;
    max-width: 677px;
    margin: 0 auto;
    font-family: -apple-system, BlinkMacSystemFont, "Microsoft YaHei", sans-serif;
    color: #111;
    background-color: transparent;
    /* 透明背景，兼容微信深色模式 */
    /* 顶部红蓝条装饰 */
    border-top: 8px solid #D32F2F;
    border-bottom: 8px solid #1976D2;
    word-break: break-word;
}

#wemd p {
    margin: 24px 0;
    line-height: 1.8;
    text-align: justify;
    color: #333;
    font-size: 16px;
}

/* 一级标题 - 红色几何块 */
#wemd h1 {
    margin: 60px 0 40px;
    text-align: left;
}

#wemd h1 .content {
    font-size: 26px;
    font-weight: 900;
    color: #fff;
    background: #D32F2F;
    padding: 15px 25px;
    display: inline-block;
    /* 简单的直角矩形+硬阴影，兼容性最好且有力 */
    box-shadow: 6px 6px 0 #111;
    border: 2px solid #111;
}

#wemd h1 .prefix,
#wemd h1 .suffix {
    display: none;
}

/* 二级标题 - 蓝色圆形引导 */
#wemd h2 {
    margin: 50px 0 25px;
    text-align: left;
    display: flex;
    align-items: center;
}

#wemd h2 .content {
    font-size: 20px;
    font-weight: bold;
    color: #111;
    position: relative;
    padding-left: 20px;
    border-left: 10px solid #1976D2;
    /* 蓝色竖条 */
}

#wemd h2 .prefix,
#wemd h2 .suffix {
    display: none;
}

/* 三级标题 - 黄色下划线 */
#wemd h3 {
    margin: 30px 0 15px;
}

#wemd h3 .content {
    font-size: 18px;
    font-weight: bold;
    color: #111;
    border-bottom: 5px solid #FBC02D;
    display: inline-block;
    padding-bottom: 2px;
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
    color: #1976D2;
    background: #eee;
    padding: 4px 8px;
}

#wemd h4 .prefix,
#wemd h4 .suffix {
    display: none;
}

/* 引用 - 几何框 */
#wemd .multiquote-1 {
    margin: 30px 0;
    padding: 20px;
    background: #f9f9f9;
    border: 2px solid #111;
    box-shadow: 5px 5px 0 #D32F2F;
}

#wemd .multiquote-1 p {
    color: #333;
    margin: 0;
    line-height: 1.7;
}

#wemd .multiquote-2 {
    margin: 28px 0;
    padding: 20px;
    background: #fff;
    border: 2px solid #111;
    box-shadow: 4px 4px 0 #1976D2;
}

#wemd .multiquote-2 p {
    color: #333;
    margin: 0;
}

#wemd .multiquote-3 {
    margin: 26px 0;
    padding: 18px;
    background: #fff;
    border: 2px solid #111;
    box-shadow: 3px 3px 0 #FBC02D;
}

#wemd .multiquote-3 p {
    color: #333;
    margin: 0;
}

/* 列表 */
#wemd ul {
    list-style: square;
    padding-left: 20px;
    margin: 20px 0;
    color: #D32F2F;
}

/* 有序列表 - 粗黑数字 */
#wemd ol {
    list-style: decimal;
    padding-left: 20px;
    margin: 20px 0;
    color: #D32F2F;
    font-weight: bold;
}

#wemd ul ul {
    list-style-type: circle;
    color: #1976D2;
    margin-top: 8px;
}

#wemd ol ol {
    list-style-type: lower-alpha;
    color: #D32F2F;
}

#wemd li section {
    color: #333;
    font-weight: normal;
}

/* 链接 - 蓝色背景高亮 */
#wemd a {
    color: #111;
    text-decoration: none;
    background-color: rgba(25, 118, 210, 0.2);
    border-bottom: 1px solid #1976D2;
    padding: 0 2px;
    font-weight: bold;
}

/* 加粗 - 红色 */
#wemd strong {
    color: #D32F2F;
    font-weight: 900;
}

/* 斜体 - 蓝色 */
#wemd em {
    font-style: italic;
    color: #1976D2;
    font-weight: bold;
}

/* 加粗斜体 */
#wemd em strong {
    color: #D32F2F;
    font-weight: 900;
}

/* 高亮 - 黄色块 */
#wemd mark {
    background: #FBC02D;
    color: #000;
    padding: 2px 6px;
    font-weight: bold;
}

/* 删除线 - 粗红线 */
#wemd del {
    text-decoration: line-through;
    text-decoration-thickness: 2px;
    text-decoration-color: #D32F2F;
    color: #666;
}

/* 分割线 - 粗黑线 */
#wemd hr {
    margin: 40px 0;
    border: none;
    height: 4px;
    background: #000;
}

/* 
 * 行内代码 - 黄色高亮 (修复重点) 
 * 亮黄背景 + 黑色文字 + 粗体
 */
#wemd p code,
#wemd li code {
    background: #FBC02D;
    /* 包豪斯黄 */
    color: #000;
    /* 纯黑字 */
    padding: 2px 6px;
    margin: 0 4px;
    font-size: 14px;
    font-weight: bold;
    font-family: sans-serif;
    /* 几何感 */
}

/* 图片 - 黑框硬阴影 */
#wemd img {
    display: block;
    margin: 40px auto;
    width: 100%;
    border: 3px solid #111;
    box-shadow: 6px 6px 0 #1976D2;
    /* 蓝色硬阴影 */
}

#wemd figcaption {
    margin-top: 10px;
    text-align: center;
    color: #111;
    font-size: 14px;
    font-weight: bold;
    background: #FBC02D;
    padding: 4px 8px;
    display: inline-block;
}

/* 代码块 - 极简黑 */
#wemd pre code.hljs {
    background: #111;
    color: #f5f5f5; /* 默认亮色文字 */
    padding: 20px;
    border-radius: 0;
    font-family: monospace;
    border: 2px solid #111;
}

/* 语法高亮颜色覆盖 - 确保在黑色背景上可读 */
#wemd pre code.hljs .hljs-keyword,
#wemd pre code.hljs .hljs-selector-tag,
#wemd pre code.hljs .hljs-built_in,
#wemd pre code.hljs .hljs-name,
#wemd pre code.hljs .hljs-tag {
    color: #FBC02D; /* 包豪斯黄 */
}

#wemd pre code.hljs .hljs-string,
#wemd pre code.hljs .hljs-title,
#wemd pre code.hljs .hljs-section,
#wemd pre code.hljs .hljs-attribute,
#wemd pre code.hljs .hljs-literal,
#wemd pre code.hljs .hljs-template-tag,
#wemd pre code.hljs .hljs-template-variable,
#wemd pre code.hljs .hljs-type {
    color: #D32F2F; /* 包豪斯红 */
}

#wemd pre code.hljs .hljs-comment,
#wemd pre code.hljs .hljs-quote {
    color: #888; /* 灰色注释 */
}

#wemd pre code.hljs .hljs-number,
#wemd pre code.hljs .hljs-regexp,
#wemd pre code.hljs .hljs-variable,
#wemd pre code.hljs .hljs-params {
    color: #1976D2; /* 包豪斯蓝 */
}

/* 如果没有语法高亮，设置默认黄色 */
#wemd pre code:not(.hljs) {
    color: #FBC02D;
    background: #111;
    border: 2px solid #111;
}

/* 表格 - 粗线网格 */
#wemd table {
    width: 100%;
    border-collapse: collapse;
    margin: 30px 0;
    border: 2px solid #111;
}

#wemd table tr th {
    background: #1976D2;
    color: #fff;
    border: 1px solid #111;
    padding: 10px;
}

#wemd table tr td {
    border: 1px solid #111;
    padding: 10px;
    color: #333;
}

/* 脚注 */
#wemd .footnote-word,
#wemd .footnote-ref {
    color: #1976D2;
    font-weight: bold;
}

#wemd .footnotes-sep {
    border-top: 2px solid #111;
    margin-top: 40px;
    padding-top: 20px;
}

#wemd .footnote-num {
    font-weight: 900;
    color: #fff;
    background: #D32F2F;
    padding: 2px 6px;
    margin-right: 6px;
}

#wemd .footnote-item p {
    color: #333;
    font-size: 14px;
}

/* 提示块 - 包豪斯风格 */
#wemd .callout {
    margin: 30px 0;
    padding: 20px;
    background: #f9f9f9;
    border: 2px solid #111;
    box-shadow: 5px 5px 0 #FBC02D;
    border-radius: 0;
}

#wemd .callout-title {
    font-weight: 900;
    margin-bottom: 10px;
    text-transform: uppercase;
    color: #111;
    font-size: 16px;
}

#wemd .callout-icon { margin-right: 8px;
    margin-right: 6px;
}

#wemd .callout-note { 
    border-left: 10px solid #1976D2; 
}

#wemd .callout-tip { 
    border-left: 10px solid #FBC02D; 
}

#wemd .callout-important { 
    border-left: 10px solid #1976D2; 
}

#wemd .callout-warning { 
    border-left: 10px solid #FBC02D; 
}

#wemd .callout-caution { 
    border-left: 10px solid #D32F2F; 
}

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
