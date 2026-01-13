export const auroraGlassTheme = `/* 极光玻璃风格 */
#wemd {
  padding: 5px 20px;
  max-width: 677px;
  margin: 0 auto;
  font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  color: #333;
  /* 背景透明，兼容微信深色模式 */
  background-color: transparent;
  word-break: break-word;
}

/* 段落 - 增加呼吸感 */
#wemd p {
  margin-top: 22px;
  margin-bottom: 22px;
  line-height: 1.9;
  letter-spacing: 0.6px;
  text-align: justify;
  color: #444;
  font-size: 16px;
}

/* 
 * 一级标题 - 渐变流光文字
 * 使用 background-clip 实现文字渐变
 */
#wemd h1 {
  margin-top: 60px;
  margin-bottom: 50px;
  text-align: center;
}

#wemd h1 .content {
  font-size: 26px;
  font-weight: 800;
  display: inline-block;
  /* 核心渐变色：蓝 -> 紫 -> 粉 */
  background-image: linear-gradient(135deg, #4158D0 0%, #C850C0 46%, #FFCC70 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  /* 文字透明，透出背景 */
  line-height: 1.4;
  padding-bottom: 10px;
  /* 底部加一条极细的渐变线 */
  border-bottom: 2px solid #eee;
  border-image: linear-gradient(135deg, #4158D0 0%, #C850C0 100%) 1;
}

#wemd h1 .prefix,
#wemd h1 .suffix {
  display: none;
}

/* 
 * 二级标题 - 悬浮渐变按钮
 * 看起来像一个精致的 APP 图标或按钮
 */
#wemd h2 {
  margin-top: 60px;
  margin-bottom: 30px;
  text-align: left;
}

#wemd h2 .content {
  display: inline-block;
  font-size: 18px;
  font-weight: 700;
  color: #fff;
  /* 白字 */
  /* 同样的极光渐变背景 */
  background-image: linear-gradient(90deg, #4158D0 0%, #C850C0 100%);
  padding: 8px 18px;
  border-radius: 20px 20px 20px 4px;
  /* 不对称圆角，更灵动 */
  box-shadow: 0 8px 16px rgba(200, 80, 192, 0.3);
  /* 彩色弥散投影 */
  line-height: 1.2;
}

#wemd h2 .prefix,
#wemd h2 .suffix {
  display: none;
}

/* 
 * 三级标题 - 渐变下划线
 */
#wemd h3 {
  margin-top: 35px;
  margin-bottom: 15px;
}

#wemd h3 .content {
  font-size: 17px;
  font-weight: 700;
  color: #333;
  display: inline-block;
  position: relative;
  /* 使用 background 模拟只有一半高度的下划线 */
  background: linear-gradient(90deg, rgba(65, 88, 208, 0.2) 0%, rgba(200, 80, 192, 0.2) 100%);
  background-size: 100% 40%;
  /* 宽度100%，高度40% */
  background-repeat: no-repeat;
  background-position: 0 90%;
  /* 位于底部 */
  padding: 0 4px;
}

#wemd h3 .prefix,
#wemd h3 .suffix {
  display: none;
}

/* 
 * 四级标题 - 极简圆点
 */
#wemd h4 {
  margin-top: 24px;
  margin-bottom: 12px;
  text-align: left;
}

#wemd h4 .content {
  display: inline-block;
  font-size: 16px;
  font-weight: 700;
  color: #4158D0;
  background-color: #f0f2ff;
  padding: 4px 12px;
  border-radius: 12px;
  line-height: 1.4;
}

#wemd h4 .prefix,
#wemd h4 .suffix {
  display: none;
}

/* 
 * 列表 - 炫彩圆点
 */
#wemd ul {
  list-style-type: disc;
  padding-left: 20px;
  margin: 20px 0;
  color: #C850C0;
  /* 列表符号粉紫色 */
}

#wemd ul li {
  margin-bottom: 10px;
  line-height: 1.8;
}

#wemd li section {
  color: #444;
  /* 正文深灰 */
  font-size: 16px;
}

/* 有序列表 - 渐变色数字 (通过颜色模拟) */
#wemd ol {
  list-style-type: decimal;
  padding-left: 20px;
  margin: 20px 0;
  color: #4158D0;
  /* 数字深蓝 */
  font-weight: bold;
}

#wemd ul ul {
  list-style-type: circle;
  color: #4158D0;
  margin-top: 8px;
}

#wemd ol ol {
  list-style-type: lower-roman;
  color: #C850C0;
}

#wemd ol li {
  margin-bottom: 10px;
  line-height: 1.8;
}

#wemd ol li section {
  color: #444;
  font-weight: normal;
  font-size: 16px;
}

/* 
 * 引用 - 磨砂玻璃卡片
 * 白底 + 柔和彩色投影 + 细微边框
 */
#wemd .multiquote-1,
#wemd .multiquote-2,
#wemd .multiquote-3 {
  margin: 36px 0;
  padding: 24px;
  background-color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.8);
  /* 关键：双重投影，一层白光，一层彩光 */
  box-shadow: -4px -4px 10px rgba(255, 255, 255, 0.8), 4px 4px 20px rgba(65, 88, 208, 0.1);
  border-radius: 16px;
  /* 顶部渐变装饰条 */
  border-top: 4px solid #C850C0;
  overflow: visible !important;
}

#wemd .multiquote-1 p,
#wemd .multiquote-2 p,
#wemd .multiquote-3 p {
  margin: 0;
  color: #555;
  font-size: 15px;
  line-height: 1.8;
}

/* 链接 - 渐变虚线 */
#wemd a {
  color: #C850C0;
  text-decoration: none;
  border-bottom: 1px dashed #C850C0;
  font-weight: 600;
  padding-bottom: 1px;
}

/* 
 * 加粗 - 渐变文字
 * 与 H1 呼应，非常高级
 */
#wemd strong {
  font-weight: 700;
  background-image: linear-gradient(135deg, #4158D0 0%, #C850C0 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  /* 文字透明，显示渐变 */
  /* 兼容性回退：如果不支持渐变文字，会显示上面的 color (这里设为 transparent 需注意) */
  /* 为了兼容，我们可以设一个 color fallback，但在 CSS 中很难覆盖 transparent */
  /* 微信环境完全支持 background-clip: text */
  margin: 0 1px;
}

/* 斜体 */
#wemd em {
  color: #C850C0;
  font-style: italic;
}

#wemd em strong {
  color: #C850C0;
}

/* 高亮 - 渐变背景 */
#wemd mark {
    background: linear-gradient(135deg, rgba(65, 88, 208, 0.15), rgba(200, 80, 192, 0.15));
    color: #4158D0;
    padding: 2px 4px;
    border-radius: 3px;
}

/* 删除线 - 渐变色 */
#wemd del {
    text-decoration: line-through;
    color: #999;
    text-decoration-color: #C850C0;
}

/* 分隔线 - 渐变光束 */
#wemd hr {
  margin: 60px auto;
  border: 0;
  height: 2px;
  background-image: linear-gradient(90deg, rgba(247, 249, 252, 0) 0%, #C850C0 50%, rgba(247, 249, 252, 0) 100%);
  width: 80%;
}

/* 图片 - 悬浮投影 */
#wemd img {
  display: block;
  margin: 40px auto;
  width: 100%;
  border-radius: 12px;
  /* 柔和的彩色投影 */
  box-shadow: 0 15px 35px rgba(65, 88, 208, 0.12);
}

/* 行内代码 - 气泡风格 */
#wemd p code,
#wemd li code {
  color: #4158D0;
  background: #f0f2ff;
  border: 1px solid rgba(65, 88, 208, 0.1);
  padding: 3px 6px;
  margin: 0 4px;
  border-radius: 6px;
  font-size: 14px;
  font-family: sans-serif;
}

/* 代码块 - 极简深色圆角 */
/* 代码块 - 注意：不要设置 color，让语法高亮主题控制文字颜色 */
#wemd pre code.hljs {
  display: block;
  padding: 20px;
  background: #282c34;
  /* 经典的 Atom One Dark */
  color: #abb2bf;
  /* 默认文字颜色 */
  font-size: 13px;
  line-height: 1.6;
  border-radius: 12px;
  font-family: sans-serif;
  overflow-x: auto;
  white-space: pre;
  min-width: max-content;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
}

/* 优化深色背景下的语法高亮颜色 */
#wemd pre code.hljs .hljs-comment,
#wemd pre code.hljs .hljs-quote {
  color: #5c6370;
}

#wemd pre code.hljs .hljs-keyword,
#wemd pre code.hljs .hljs-selector-tag {
  color: #c678dd;
  font-weight: bold;
}

#wemd pre code.hljs .hljs-string,
#wemd pre code.hljs .hljs-doctag {
  color: #98c379;
}

#wemd pre code.hljs .hljs-number,
#wemd pre code.hljs .hljs-literal {
  color: #d19a66;
}

#wemd pre code.hljs .hljs-title,
#wemd pre code.hljs .hljs-section {
  color: #61afef;
  font-weight: bold;
}

#wemd pre code.hljs .hljs-built_in,
#wemd pre code.hljs .hljs-builtin-name {
  color: #e06c75;
}

/* 如果没有语法高亮，设置默认灰色 */
#wemd pre code:not(.hljs) {
  color: #abb2bf;
  background: #282c34;
}

/* 表格 - 清新风格 */
#wemd table {
  width: 100%;
  border-collapse: collapse;
  margin: 40px 0;
  font-size: 14px;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.03);
  border: 1px solid #f0f0f0;
}

#wemd table tr th {
  background: #f4f6f9;
  color: #4158D0;
  font-weight: 700;
  border: 1px solid #f0f0f0;
  padding: 12px 10px;
  text-align: left;
}

#wemd table tr td {
  border: 1px solid #f0f0f0;
  padding: 12px 10px;
  color: #555;
  background: #fff;
}

/* 脚注 */
#wemd .footnote-word,
#wemd .footnote-ref {
  color: #4158D0;
}

#wemd .footnotes-sep {
  border-top: 1px solid #eee;
  padding-top: 20px;
  margin-top: 60px;
  font-size: 12px;
  color: #ccc;
  text-align: center;
}

#wemd .footnote-num {
  font-weight: bold;
  color: #fff;
  background: #C850C0;
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
  color: #999;
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

/* 提示块 - 极光玻璃风格 */
#wemd .callout {
  margin: 30px 0;
  padding: 20px;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 8px 20px rgba(65, 88, 208, 0.1);
}

#wemd .callout-title {
  font-weight: 700;
  margin-bottom: 10px;
  background: linear-gradient(135deg, #4158D0, #C850C0);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  font-size: 16px;
}

#wemd .callout-icon { margin-right: 8px;
  margin-right: 6px;
}

#wemd .callout-note {
  border-left: 4px solid #6366f1;
}

#wemd .callout-tip {
  border-left: 4px solid #C850C0;
}

#wemd .callout-important {
  border-left: 4px solid #4158D0;
}

#wemd .callout-warning {
  border-left: 4px solid #FFCC70;
}

#wemd .callout-caution {
  border-left: 4px solid #ef4444;
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
