export const sunsetFilmTheme = `/* 落日胶片风格 */
#wemd {
    padding: 5px 22px;
    max-width: 677px;
    margin: 0 auto;
    /* 强制使用衬线体，营造电影字幕感 */
    font-family: "Songti SC", "SimSun", "STSong", "Georgia", serif;
    color: #4A3B32;
    /* 深咖啡色文字，比黑色更柔和 */
    background-color: transparent;
    /* 透明背景，兼容微信深色模式 */
    word-break: break-word;
}

/* 段落 - 像是在读一封旧信 */
#wemd p {
    margin-top: 26px;
    margin-bottom: 26px;
    line-height: 1.9;
    letter-spacing: 0.8px;
    /* 字间距稍大 */
    text-align: justify;
    color: #5D4037;
    font-size: 16px;
}

/* 
 * 一级标题 - 电影片名风格
 * 上下双线装饰
 */
#wemd h1 {
    margin-top: 60px;
    margin-bottom: 50px;
    text-align: center;
    border-top: 4px double #B33D25;
    /* 双实线 */
    border-bottom: 1px solid #B33D25;
    padding: 20px 0;
}

#wemd h1 .content {
    font-size: 26px;
    font-weight: 900;
    color: #B33D25;
    display: inline-block;
    line-height: 1.2;
    letter-spacing: 3px;
}

#wemd h1 .prefix,
#wemd h1 .suffix {
    display: none;
}

/* 
 * 二级标题 - 邮票/标签风格
 * 实心背景 + 白字
 */
#wemd h2 {
    margin-top: 50px;
    margin-bottom: 30px;
    text-align: left;
}

#wemd h2 .content {
    display: inline-block;
    font-size: 19px;
    font-weight: bold;
    color: #FFFBF0;
    /* 米白字 */
    background-color: #B33D25;
    /* 陶土红底 */
    padding: 8px 16px;
    border-radius: 2px;
    box-shadow: 4px 4px 0px rgba(179, 61, 37, 0.2);
    /* 淡淡的复古阴影 */
    line-height: 1.2;
}

#wemd h2 .prefix,
#wemd h2 .suffix {
    display: none;
}

/* 
 * 三级标题 - 像书本的小节
 * 咖啡色文字 + 左侧装饰
 */
#wemd h3 {
    margin-top: 40px;
    margin-bottom: 20px;
}

#wemd h3 .content {
    font-size: 18px;
    font-weight: bold;
    color: #8D5B4C;
    display: inline-block;
    padding-left: 10px;
    border-left: 4px solid #D98C45;
    /* 琥珀黄 */
}

#wemd h3 .prefix,
#wemd h3 .suffix {
    display: none;
}

/* 
 * 四级标题 - 极简下划线
 */
#wemd h4 {
    margin-top: 30px;
    margin-bottom: 15px;
    text-align: left;
}

#wemd h4 .content {
    display: inline-block;
    font-size: 16px;
    font-weight: bold;
    color: #B33D25;
    border-bottom: 2px solid #F2C94C;
    /* 亮黄线条 */
    padding-bottom: 2px;
}

#wemd h4 .prefix,
#wemd h4 .suffix {
    display: none;
}

/* 列表 - 经典的实心方点 */
#wemd ul {
    list-style-type: square;
    padding-left: 20px;
    margin: 20px 0;
    color: #D98C45;
}

#wemd ul li {
    margin-bottom: 12px;
    line-height: 1.8;
}

#wemd li section {
    color: #5D4037;
    font-size: 16px;
}

/* 有序列表 */
#wemd ol {
    list-style-type: decimal;
    padding-left: 20px;
    margin: 20px 0;
    color: #B33D25;
    font-weight: bold;
    font-family: serif;
    /* 数字也用衬线体，很有味道 */
}

#wemd ol li {
    margin-bottom: 12px;
    line-height: 1.8;
}

#wemd ol li section {
    color: #5D4037;
    font-weight: normal;
    font-size: 16px;
}

#wemd ul ul {
    list-style-type: circle;
    color: #8D5B4C;
    margin-top: 8px;
}

#wemd ol ol {
    list-style-type: lower-roman;
    color: #B33D25;
}

/* 
 * 引用 - 泛黄的旧报纸
 * 深米色背景 + 棕色边框
 */
#wemd .multiquote-1,
#wemd .multiquote-2,
#wemd .multiquote-3 {
    margin: 36px 0;
    padding: 24px;
    background-color: #F7EED6;
    /* 泛黄背景 */
    border-left: 3px solid #8D5B4C;
    /* 咖啡色边框 */
    border-radius: 2px;
    overflow: visible !important;
}

#wemd .multiquote-1 p,
#wemd .multiquote-2 p,
#wemd .multiquote-3 p {
    margin: 0;
    color: #6D4C41;
    font-size: 15px;
    line-height: 1.8;
    font-style: italic;
}

#wemd .multiquote-2 {
    margin: 34px 0;
    padding: 22px;
    background: #FFF8E7;
    border-left: 3px solid #D98C45;
    border-radius: 2px;
}

#wemd .multiquote-3 {
    margin: 32px 0;
    padding: 20px;
    background: #FFFBF0;
    border-left: 2px solid #D98C45;
    border-radius: 2px;
}

/* 链接 - 像是手写的下划线 */
#wemd a {
    color: #B33D25;
    text-decoration: none;
    border-bottom: 1px solid #B33D25;
    font-weight: bold;
    transition: opacity 0.2s;
}

/* 
 * 加粗 - 重点标记
 * 像是用深色马克笔划过
 */
#wemd strong {
    color: #B33D25;
    font-weight: 900;
    margin: 0 2px;
}

/* 斜体 */
#wemd em {
    color: #D98C45;
    font-style: italic;
    font-weight: bold;
}

#wemd em strong {
    color: #B33D25;
}

/* 高亮 - 暖黄背景 */
#wemd mark {
    background: rgba(242, 201, 76, 0.3);
    color: #B33D25;
    padding: 2px 4px;
    border-radius: 2px;
}

/* 删除线 */
#wemd del {
    text-decoration: line-through;
    color: #8D5B4C;
}

/* 分隔线 - 虚线剪裁线 */
#wemd hr {
    margin: 60px auto;
    border: 0;
    height: 1px;
    border-top: 2px dashed #D98C45;
    /* 剪裁线风格 */
    width: 100%;
}

/* 
 * 图片 - 老照片风格
 * 加上白色边框和阴影
 */
#wemd img {
    display: block;
    margin: 40px auto;
    width: 95%;
    /* 稍微留点白边 */
    border: 8px solid #fff;
    /* 模拟照片白边 */
    box-shadow: 0 10px 25px rgba(93, 64, 55, 0.15);
    background: #fff;
}

#wemd figcaption {
    font-size: 13px;
    color: #8D5B4C;
    margin-top: 15px;
    font-style: italic;
    font-family: serif;
}

/* 行内代码 - 咖啡色块 */
#wemd p code,
#wemd li code {
    color: #5D4037;
    background: #EFE6D5;
    border: none;
    padding: 2px 6px;
    margin: 0 4px;
    border-radius: 3px;
    font-size: 14px;
    font-family: serif;
    /* 代码也用衬线体，保持复古感 */
}

/* 代码块 - 复古打字机配色 */
/* 代码块 - 注意：不要设置 color，让语法高亮主题控制文字颜色 */
#wemd pre code.hljs {
    display: block;
    padding: 20px;
    background: #4A3B32;
    /* 深咖啡背景 */
    color: #E6CBB5;
    /* 默认奶茶色文字 */
    font-size: 13px;
    line-height: 1.6;
    border-radius: 4px;
    font-family: "Courier New", Courier, monospace;
    /* 打字机字体 */
    overflow-x: auto;
    white-space: pre;
  min-width: max-content;
    border: 4px solid #F7EED6;
}

/* 优化深色背景下的语法高亮颜色 - 使用暖色调高对比度颜色 */
#wemd pre code.hljs .hljs-comment,
#wemd pre code.hljs .hljs-quote {
    color: #A68B7A;
}

#wemd pre code.hljs .hljs-keyword,
#wemd pre code.hljs .hljs-selector-tag {
    color: #FFB84D;
    font-weight: bold;
}

#wemd pre code.hljs .hljs-string,
#wemd pre code.hljs .hljs-doctag {
    color: #FFD4A3;
}

#wemd pre code.hljs .hljs-number,
#wemd pre code.hljs .hljs-literal {
    color: #C9A961;
}

#wemd pre code.hljs .hljs-title,
#wemd pre code.hljs .hljs-section {
    color: #F7EED6;
    font-weight: bold;
}

#wemd pre code.hljs .hljs-built_in,
#wemd pre code.hljs .hljs-builtin-name {
    color: #E6CBB5;
    font-weight: bold;
}

/* 如果没有语法高亮，设置默认奶茶色 */
#wemd pre code:not(.hljs) {
    color: #E6CBB5;
    background: #4A3B32;
    border: 4px solid #F7EED6;
}

/* 表格 - 复古账单 */
#wemd table {
    width: 100%;
    border-collapse: collapse;
    margin: 40px 0;
    font-size: 14px;
    border: 2px solid #8D5B4C;
}

#wemd table tr th {
    background: #EFE6D5;
    color: #4A3B32;
    font-weight: bold;
    border: 1px solid #8D5B4C;
    padding: 12px 10px;
    text-align: center;
}

#wemd table tr td {
    border: 1px solid #8D5B4C;
    padding: 12px 10px;
    color: #5D4037;
    background: #FFFBF0;
}

/* 脚注 */
#wemd .footnote-word,
#wemd .footnote-ref {
    color: #B33D25;
}

#wemd .footnotes-sep {
    border-top: 1px solid #D98C45;
    padding-top: 20px;
    margin-top: 60px;
    font-size: 12px;
    color: #8D5B4C;
    text-align: center;
    font-family: serif;
}

#wemd .footnote-num {
    font-weight: bold;
    color: #FFFBF0;
    background-color: #D98C45;
    border-radius: 50%;
    width: 16px;
    height: 16px;
    display: inline-block;
    text-align: center;
    line-height: 16px;
    font-size: 11px;
    margin-right: 4px;
}

#wemd .footnote-item p {
    color: #8D5B4C;
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

/* 提示块 - 落日胶片风格 */
#wemd .callout {
    margin: 36px 0;
    padding: 24px;
    background: #F7EED6;
    border-left: 3px solid #8D5B4C;
    border-radius: 2px;
}

#wemd .callout-title {
    font-weight: bold;
    margin-bottom: 10px;
    color: #B33D25;
    font-family: serif;
    font-size: 15px;
}

#wemd .callout-icon { margin-right: 8px;
    margin-right: 6px;
}

#wemd .callout-note { border-left-color: #8D5B4C; }
#wemd .callout-tip { border-left-color: #D98C45; }
#wemd .callout-important { border-left-color: #8D5B4C; }
#wemd .callout-warning { border-left-color: #D98C45; }
#wemd .callout-caution { border-left-color: #B33D25; }

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
