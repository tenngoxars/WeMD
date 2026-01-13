export const knowledgeBaseTheme = `/* 知识库风格 */
#wemd {
    padding: 5px 24px;
    max-width: 677px;
    margin: 0 auto;
    /* 使用系统无衬线字体，保持干净利落 */
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", "PingFang SC", sans-serif;
    color: #37352F;
    /* 经典的笔记深灰色 */
    background-color: transparent;
    /* 透明背景，兼容微信深色模式 */
    word-break: break-word;
}

/* 段落 - 紧凑但舒适 */
#wemd p {
    margin-top: 16px;
    margin-bottom: 16px;
    line-height: 1.75;
    letter-spacing: 0.2px;
    text-align: justify;
    color: #37352F;
    font-size: 16px;
}

/* 
 * 一级标题 - 页面标题感
 * 就像笔记页面的最顶端标题
 */
#wemd h1 {
    margin-top: 50px;
    margin-bottom: 40px;
    text-align: left;
    border-bottom: 1px solid #E3E2E0;
    /* 极细的分割线 */
    padding-bottom: 20px;
}

#wemd h1 .content {
    font-size: 28px;
    font-weight: 700;
    color: #37352F;
    display: inline-block;
    line-height: 1.2;
}

#wemd h1 .prefix,
#wemd h1 .suffix {
    display: none;
}

/* 
 * 二级标题 - 区块分割
 * 带有浅灰色背景条，类似 Notion 的 H1 block
 */
#wemd h2 {
    margin-top: 40px;
    margin-bottom: 20px;
    text-align: left;
}

#wemd h2 .content {
    display: block;
    /* 占满整行 */
    font-size: 22px;
    font-weight: 600;
    color: #37352F;
    padding: 8px 12px;
    background-color: #F7F6F3;
    /* 经典的浅灰底色 */
    border-radius: 4px;
    line-height: 1.3;
}

#wemd h2 .prefix,
#wemd h2 .suffix {
    display: none;
}

/* 
 * 三级标题 - 重点标记
 * 像是给文字加了颜色标记
 */
#wemd h3 {
    margin-top: 30px;
    margin-bottom: 12px;
}

#wemd h3 .content {
    font-size: 18px;
    font-weight: 600;
    color: #37352F;
    display: inline-block;
    /* 底部局部高亮 */
    border-bottom: 3px solid #FDECC8;
    /* 奶黄色 */
    padding-bottom: 2px;
}

#wemd h3 .prefix,
#wemd h3 .suffix {
    display: none;
}

/* 四级标题 - 小节 */
#wemd h4 {
    margin-top: 24px;
    margin-bottom: 8px;
    text-align: left;
}

#wemd h4 .content {
    display: inline-block;
    font-size: 16px;
    font-weight: 600;
    color: #EB5757;
    /* 醒目的红色，用于警示或强调 */
    line-height: 1.4;
}

#wemd h4 .prefix,
#wemd h4 .suffix {
    display: none;
}

/* 
 * 列表 - 结构化缩进
 */
#wemd ul {
    list-style-type: disc;
    padding-left: 24px;
    margin: 16px 0;
    color: #37352F;
}

#wemd ul li {
    margin-bottom: 8px;
    line-height: 1.7;
}

#wemd li section {
    color: #37352F;
    font-size: 16px;
}

/* 有序列表 */
#wemd ol {
    list-style-type: decimal;
    padding-left: 24px;
    margin: 16px 0;
    color: #37352F;
    font-weight: 600;
}

#wemd ul ul {
    list-style-type: circle;
    margin-top: 6px;
}

#wemd ol ol {
    list-style-type: lower-alpha;
}

#wemd ol li {
    margin-bottom: 8px;
    line-height: 1.7;
}

#wemd ol li section {
    color: #37352F;
    font-weight: normal;
    font-size: 16px;
}

/* 
 * 引用 - Callout 提示框风格
 * 这是这款主题的灵魂
 */
#wemd .multiquote-1,
#wemd .multiquote-2,
#wemd .multiquote-3 {
    margin: 24px 0;
    padding: 16px 16px 16px 20px;
    background-color: #F1F1EF;
    /* 默认浅灰背景 */
    border: none;
    /* 无边框 */
    border-radius: 4px;
    border-left: 4px solid #37352F;
    /* 左侧深色强提示 */
    overflow: visible !important;
}

/* 针对不同层级引用，给予不同颜色，模拟 Info/Warning */
#wemd .multiquote-2 {
    background-color: #E7F3F8;
    /* 浅蓝背景 (Info) */
    border-left-color: #2D9CDB;
}

#wemd .multiquote-3 {
    background-color: #FDF5F2;
    /* 浅橙背景 (Warning) */
    border-left-color: #F2994A;
}

#wemd .multiquote-1 p,
#wemd .multiquote-2 p,
#wemd .multiquote-3 p {
    margin: 0;
    color: #37352F;
    font-size: 15px;
    line-height: 1.6;
}

/* 链接 - 简洁下划线 */
#wemd a {
    color: #37352F;
    text-decoration: none;
    border-bottom: 1px solid #999;
    /* 灰色下划线 */
    font-weight: 500;
    transition: border-color 0.2s;
}

/* 
 * 加粗 - 黄色高光笔
 * 完全复刻 Notion 的 Highlight 效果
 */
#wemd strong {
    color: #37352F;
    font-weight: 600;
    background-color: #FDECC8;
    /* 高亮黄 */
    padding: 2px 4px;
    margin: 0 2px;
    border-radius: 3px;
}

/* 斜体 */
#wemd em {
    color: #37352F;
    font-style: italic;
    opacity: 0.7;
}

#wemd em strong {
    color: #37352F;
    opacity: 1;
}

/* 高亮 - 黄色标记 */
#wemd mark {
    background: #FDECC8;
    color: #37352F;
    padding: 2px 4px;
    border-radius: 3px;
}

/* 删除线 */
#wemd del {
    text-decoration: line-through;
    color: #999;
}

/* 分隔线 */
#wemd hr {
    margin: 40px auto;
    border: 0;
    height: 1px;
    background-color: #E3E2E0;
    /* 极浅灰 */
    width: 100%;
}

/* 图片 - 干净无阴影 */
#wemd img {
    display: block;
    margin: 30px auto;
    width: 100%;
    border-radius: 4px;
    box-shadow: none;
    /* 笔记风格通常不需要阴影 */
    border: 1px solid #E3E2E0;
    /* 只有一圈细线 */
}

#wemd figcaption {
    margin-top: 8px;
    text-align: center;
    color: #999;
    font-size: 14px;
}

/* 
 * 行内代码 - 经典的红字灰底
 */
#wemd p code,
#wemd li code {
    color: #EB5757;
    /* 红色文字 */
    background: rgba(135, 131, 120, 0.15);
    /* 半透明灰底 */
    border: none;
    padding: 3px 6px;
    margin: 0 4px;
    border-radius: 4px;
    font-size: 14px;
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
}

/* 代码块 - 极简灰 */
/* 代码块 - 注意：不要设置 color，让语法高亮主题控制文字颜色 */
#wemd pre code.hljs {
    display: block;
    padding: 20px;
    background: #F7F6F3;
    /* color 由 .hljs 语法高亮主题控制 */
    font-size: 13px;
    line-height: 1.6;
    border-radius: 4px;
    font-family: "SFMono-Regular", Consolas, Menlo, monospace;
    overflow-x: auto;
    white-space: pre;
  min-width: max-content;
    border: none;
}

/* 如果没有语法高亮，设置默认深灰色 */
#wemd pre code:not(.hljs) {
    color: #37352F;
    background: #F7F6F3;
}

/* 表格 - 数据库风格 (Database) */
#wemd table {
    width: 100%;
    border-collapse: collapse;
    margin: 30px 0;
    font-size: 14px;
    border: 1px solid #E3E2E0;
    border-radius: 0;
}

#wemd table tr th {
    background: #F7F6F3;
    color: #37352F;
    font-weight: 600;
    border: 1px solid #E3E2E0;
    padding: 10px 12px;
    text-align: left;
}

#wemd table tr td {
    border: 1px solid #E3E2E0;
    padding: 10px 12px;
    color: #37352F;
    background: #fff;
}

/* 脚注 */
#wemd .footnote-word,
#wemd .footnote-ref {
    color: #37352F;
    text-decoration: underline;
}

#wemd .footnotes-sep {
    border-top: 1px solid #E3E2E0;
    padding-top: 20px;
    margin-top: 50px;
    font-size: 12px;
    color: #999;
}

#wemd .footnote-num {
    font-weight: bold;
    color: #37352F;
    margin-right: 4px;
}

#wemd .footnote-item p {
    color: #666;
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


/* 提示块 - 知识库风格 */
#wemd .callout {
    margin: 24px 0;
    padding: 16px 16px 16px 20px;
    border-radius: 4px;
    border-left: 4px solid #37352F;
}

#wemd .callout-title {
    font-weight: 600;
    margin-bottom: 8px;
    color: #37352F;
    font-size: 15px;
}

#wemd .callout-icon { margin-right: 8px;
    margin-right: 6px;
}

#wemd .callout-note { 
    background: #F1F1EF;
    border-left-color: #37352F;
}

#wemd .callout-tip { 
    background: #FDF5F2;
    border-left-color: #F2994A;
}

#wemd .callout-important { 
    background: #E7F3F8;
    border-left-color: #2D9CDB;
}

#wemd .callout-warning { 
    background: #FFF4E5;
    border-left-color: #FF9800;
}

#wemd .callout-caution { 
    background: #FFEBEE;
    border-left-color: #F44336;
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
