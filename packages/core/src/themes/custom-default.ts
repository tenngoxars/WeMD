export const customDefaultTheme = `/* 自定义样式,实时生效,浏览器实时缓存 */

/* 全局属性
 * 页边距 padding: 30px;
 * 全文字体 font-family: ptima-Regular;
 * 英文换行 word-break: break-all;
 */
#wemd {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  color: #2c3e50;
  line-height: 1.8;
  font-size: 16px;
  letter-spacing: 0.3px;
}

/* 段落,下方未标注标签参数均同此处
 * 上边距 margin-top: 5px;
 * 下边距 margin-bottom: 5px;
 * 行高 line-height: 26px;
 * 词间距 word-spacing: 3px;
 * 字间距 letter-spacing: 3px;
 * 对齐 text-align: left;
 * 颜色 color: #3e3e3e;
 * 字体大小 font-size: 16px;
 * 首行缩进 text-indent: 2em;
 */
#wemd p {
  margin: 8px 0;
  font-size: 16px;
  color: #34495e;
  line-height: 1.8;
  letter-spacing: 0.5px;
}

/* 一级标题 */
#wemd h1 {
  font-size: 28px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 10px 0 20px;
  text-align: center;
  padding-bottom: 12px;
  border-bottom: 2px solid #07c160;
  letter-spacing: 1px;
}

/* 一级标题内容 */
#wemd h1 .content {
}

/* 一级标题前缀 */
#wemd h1 .prefix {
}

/* 一级标题后缀 */
#wemd h1 .suffix {
}

/* 二级标题 */
#wemd h2 {
  font-size: 22px;
  font-weight: 600;
  color: #2c3e50;
  margin: 20px 0 14px;
  padding-left: 12px;
  border-left: 4px solid #07c160;
  line-height: 1.4;
  letter-spacing: 0.5px;
}

/* 二级标题内容 */
#wemd h2 .content {
}

/* 二级标题前缀 */
#wemd h2 .prefix {
}

/* 二级标题后缀 */
#wemd h2 .suffix {
}

/* 三级标题 */
#wemd h3 {
  font-size: 19px;
  font-weight: 600;
  color: #34495e;
  margin: 24px 0 12px;
  padding-left: 10px;
  border-left: 3px solid #07c160;
  letter-spacing: 0.3px;
}

/* 三级标题内容 */
#wemd h3 .content {
}

/* 三级标题前缀 */
#wemd h3 .prefix {
}

/* 三级标题后缀 */
#wemd h3 .suffix {
}

/* 四级标题 */
#wemd h4 {
  font-size: 17px;
  font-weight: 600;
  color: #07c160;
  margin: 20px 0 10px;
  letter-spacing: 0.3px;
}

/* 四级标题内容 */
#wemd h4 .content {
}

/* 四级标题前缀 */
#wemd h4 .prefix {
}

/* 四级标题后缀 */
#wemd h4 .suffix {
}

/* 五级标题 */
#wemd h5 {
  font-size: 16px;
  font-weight: 600;
  color: #5a6c7d;
  margin: 18px 0 8px;
}

/* 六级标题 */
#wemd h6 {
  font-size: 15px;
  font-weight: 600;
  color: #7f8c8d;
  margin: 16px 0 8px;
}

/* 无序列表整体样式
 * list-style-type: square|circle|disc;
 */
#wemd ul {
  padding-left: 24px;
  list-style-type: disc;
  color: #34495e;
}

#wemd ul li {
  padding-left: 4px;
  color: #07c160;
}

#wemd ul li section {
  color: #34495e;
}

/* 嵌套列表 */
#wemd ul ul {
  list-style-type: circle;
}

#wemd ul ul ul {
  list-style-type: square;
}

/* 有序列表整体样式
 * list-style-type: upper-roman|lower-greek|lower-alpha;
 */
#wemd ol {
  padding-left: 24px;
  list-style-type: decimal;
  color: #34495e;
}

#wemd ol li {
  padding-left: 4px;
}

/* 列表内容,不要设置li
 */
#wemd li section {
  margin: 8px 0;
  line-height: 1.8;
  font-size: 16px;
  color: #34495e;
}

/* 一级引用
 * 左边缘颜色 border-left-color: black;
 * 背景色 background: gray;
 */
#wemd .multiquote-1 {
  border-left: 4px solid #07c160;
  background: #f6f8fa;
  padding: 16px 20px;
  margin: 20px 0;
  color: #475569;
  border-radius: 2px;
}

/* 一级引用文字 */
#wemd .multiquote-1 p {
  margin: 0;
  font-size: 15px;
  color: #475569;
  line-height: 1.8;
}

/* 二级引用
 */
#wemd .multiquote-2 {
  border-left: 3px solid #00a854;
  background: #fafafa;
  padding: 14px 18px;
  margin: 16px 0;
  border-radius: 2px;
}

/* 二级引用文字 */
#wemd .multiquote-2 p {
  margin: 0;
  font-size: 15px;
  color: #64748b;
  line-height: 1.7;
}

/* 三级引用
 */
#wemd .multiquote-3 {
  border-left: 2px solid #07c160;
  background: #fafafa;
  padding: 12px 16px;
  margin: 14px 0;
  border-radius: 2px;
}

/* 三级引用文字 */
#wemd .multiquote-3 p {
  margin: 0;
  font-size: 14px;
  color: #64748b;
}

/* 链接 
 * border-bottom: 1px solid #009688;
 */
#wemd a {
  color: #07c160;
  text-decoration: none;
  border-bottom: 1px solid #07c160;
  font-weight: 500;
}

/* 加粗 */
#wemd strong {
  font-weight: 600;
  color: #07c160;
  letter-spacing: 0.2px;
}

/* 斜体 */
#wemd em {
  font-style: italic;
  color: #07c160;
  font-weight: 500;
}

/* 加粗斜体 */
#wemd em strong {
  font-weight: 700;
  font-style: italic;
  color: #00a854;
}

/* 删除线 */
#wemd del {
  text-decoration: line-through;
  color: #94a3b8;
  opacity: 0.7;
}

/* 分隔线
* 粗细、样式和颜色
* border-top: 1px solid #3e3e3e;
*/
#wemd hr {
  border: none;
  height: 1px;
  background: #e2e8f0;
  margin: 28px 0;
}

/* 图片
* 宽度 width: 80%;
* 居中 margin: 0 auto;
* 居左 margin: 0 0;
*/
#wemd img {
  display: block;
  margin: 24px auto;
  max-width: 100%;
  border-radius: 4px;
}

/* 图片描述文字 */
#wemd figcaption {
  text-align: center;
  font-size: 14px;
  color: #94a3b8;
  margin-top: 8px;
  letter-spacing: 0.2px;
}

/* 行内代码 */
#wemd p code, #wemd li code {
  background: #f0fdf4;
  padding: 3px 6px;
  border-radius: 3px;
  color: #059669;
  font-family: "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, monospace;
  font-size: 0.9em;
  margin: 0 3px;
  border: 1px solid #bbf7d0;
}

/* 
 * 代码块不换行 display: -webkit-box !important;
 * 代码块换行 display: block;
 */
#wemd pre code {
  display: block;
  background: #f8fafc;
  padding: 16px;
  border-radius: 4px;
  overflow-x: auto;
  font-family: "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, monospace;
  font-size: 14px;
  line-height: 1.6;
  color: #334155;
  border: 1px solid #e2e8f0;
}

/*
 * 表格内的单元格
 * 字体大小 font-size: 16px;
 * 边框 border: 1px solid #ccc;
 * 内边距 padding: 5px 10px;
 */
#wemd table tr th,
#wemd table tr td {
  border: 1px solid #e2e8f0;
  padding: 10px 14px;
  font-size: 15px;
  color: #334155;
  line-height: 1.6;
}

#wemd table tr th {
  background: #f0fdf4;
  color: #065f46;
  font-weight: 600;
  letter-spacing: 0.3px;
}

#wemd table tr:nth-child(2n) {
  background-color: #f8fafc;
}

/* 
 * 某一列表格列宽控制
 * n 可以修改为具体数字,不修改时表示所有列
 * 最小列宽 min-width: 85px;
 */
#wemd table tr th:nth-of-type(n),
#wemd table tr td:nth-of-type(n){
  min-width: 100px;
}

/* 脚注文字 */
#wemd .footnote-word {
  color: #07c160;
  font-weight: 500;
  border-bottom: 1px dashed #07c160;
}

/* 脚注上标 */
#wemd .footnote-ref {
  color: #07c160;
  font-weight: 600;
}

/* "参考资料"四个字 
 * 内容 content: "参考资料";
 */
#wemd .footnotes-sep:before {
  content: "参考资料";
  font-weight: 600;
  margin-top: 36px;
  margin-bottom: 16px;
  display: block;
  font-size: 18px;
  color: #1a1a1a;
  letter-spacing: 0.5px;
}

/* 参考资料编号 */
#wemd .footnote-num {
  display: inline-block;
  width: 24px;
  text-align: right;
  margin-right: 8px;
  color: #94a3b8;
  font-weight: 500;
}

/* 参考资料文字 */
#wemd .footnote-item p { 
  display: inline;
  font-size: 14px;
  color: #64748b;
  line-height: 1.8;
}

/* 参考资料解释 */
#wemd .footnote-item p em {
  font-style: normal;
  color: #94a3b8;
  margin-left: 6px;
}

/* 行间公式
 * 最大宽度 max-width: 300% !important;
 */
#wemd .block-equation svg {
  display: block;
  margin: 20px auto;
  max-width: 300% !important;
}

/* 行内公式
 */
#wemd .inline-equation svg { 
  vertical-align: middle;
}

/* Callout 提示块 */
#wemd .callout {
  margin: 28px 0;
  padding: 22px 24px;
  border-radius: 22px;
  border: 1px solid rgba(7, 193, 96, 0.15);
  background: #ffffff;
  box-shadow: 0 25px 45px rgba(15, 23, 42, 0.12);
  position: relative;
  overflow: hidden;
}

#wemd .callout::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 22px;
  pointer-events: none;
  background: linear-gradient(120deg, rgba(7,193,96,0.05), rgba(7,89,193,0.03));
}

#wemd .callout-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
  margin-bottom: 12px;
  color: #0f172a;
  font-size: 16px;
  letter-spacing: 0.05em;
}

#wemd .callout-icon { margin-right: 8px;
  font-size: 20px;
}

#wemd .callout-note {
  border-color: rgba(100, 116, 255, 0.25);
  background: linear-gradient(135deg, #f7f9ff, #edf2ff);
}

#wemd .callout-tip {
  border-color: rgba(139, 92, 246, 0.25);
  background: linear-gradient(135deg, #f5f3ff, #ede9fe);
}

#wemd .callout-important {
  border-color: rgba(14, 165, 233, 0.25);
  background: linear-gradient(135deg, #f0f9ff, #e0f2ff);
}

#wemd .callout-warning {
  border-color: rgba(249, 158, 0, 0.25);
  background: linear-gradient(135deg, #fff8ed, #fff3dc);
}

#wemd .callout-caution {
  border-color: rgba(239, 68, 68, 0.25);
  background: linear-gradient(135deg, #fff5f5, #ffe7e7);
}


/* 高亮文本 */
#wemd mark {
  background: linear-gradient(135deg, #fff9c4, #fff59d);
  color: #1a1a1a;
  padding: 2px 4px;
  border-radius: 3px;
  font-weight: 500;
}

/* 上标 */
#wemd sup {
  font-size: 0.75em;
  vertical-align: super;
  color: #059669;
}

/* 下标 */
#wemd sub {
  font-size: 0.75em;
  vertical-align: sub;
  color: #059669;
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
