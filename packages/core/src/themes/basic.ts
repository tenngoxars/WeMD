export const basicTheme = `/* 默认样式，最佳实践 */

/* 全局属性 */
#wemd {
  font-size: 16px;
  color: black;
  padding: 0 10px;
  line-height: 1.6;
  word-spacing: 0px;
  letter-spacing: 0px;
  word-break: break-word;
  word-wrap: break-word;
  text-align: left;
  font-family: Optima-Regular, Optima, PingFangSC-light, PingFangTC-light, 'PingFang SC', Cambria, Cochin, Georgia, Times, 'Times New Roman', serif;
}

/* 段落 */
#wemd p {
  font-size: 16px;
  padding-top: 8px;
  padding-bottom: 8px;
  margin: 0;
  line-height: 26px;
  color: black;
}

/* 标题 */
#wemd h1,
#wemd h2,
#wemd h3,
#wemd h4,
#wemd h5,
#wemd h6 {
  margin-top: 30px;
  margin-bottom: 15px;
  padding: 0px;
  font-weight: bold;
  color: black;
}
#wemd h1 {
  font-size: 24px;
}
#wemd h2 {
  font-size: 22px;
}
#wemd h3 {
  font-size: 20px;
}
#wemd h4 {
  font-size: 18px;
}
#wemd h5 {
  font-size: 16px;
}
#wemd h6 {
  font-size: 16px;
}

#wemd h1 .prefix,
#wemd h2 .prefix,
#wemd h3 .prefix,
#wemd h4 .prefix,
#wemd h5 .prefix,
#wemd h6 .prefix {
  display: none;
}

#wemd h1 .suffix,
#wemd h2 .suffix,
#wemd h3 .suffix,
#wemd h4 .suffix,
#wemd h5 .suffix,
#wemd h6 .suffix {
  display: none;
}

/* 列表 */
#wemd ul,
#wemd ol {
  margin-top: 8px;
  margin-bottom: 8px;
  padding-left: 25px;
  color: black;
}
#wemd ul {
  list-style-type: disc;
}
#wemd ul ul {
  list-style-type: square;
}

#wemd ol {
  list-style-type: decimal;
}

#wemd li section {
  margin-top: 5px;
  margin-bottom: 5px;
  line-height: 26px;
  text-align: left;
  color: rgb(1,1,1); /* 只要是纯黑色微信编辑器就会把color这个属性吞掉。。。*/
  font-weight: 500;
}

/* 引用 */
#wemd blockquote {
  border: none;
}

#wemd .multiquote-1 {
  display: block;
  font-size: 0.9em;
  overflow: auto;
  overflow-scrolling: touch;
  border-left: 3px solid rgba(0, 0, 0, 0.4);
  background: rgba(0, 0, 0, 0.05);
  color: #6a737d;
  padding-top: 10px;
  padding-bottom: 10px;
  padding-left: 20px;
  padding-right: 10px;
  margin-bottom: 20px;
  margin-top: 20px;
}

#wemd .multiquote-1 p {
  margin: 0px;
  color: black;
  line-height: 26px;
}

#wemd .multiquote-2 {
  box-shadow: 1px 1px 10px rgba(0,0,0,0.2);
  padding: 20px;
  margin-bottom: 20px;
  margin-top: 20px;
}

#wemd .multiquote-3 {
  box-shadow: 1px 1px 10px rgba(0,0,0,0.2);
  padding: 20px;
  margin-bottom: 20px;
  margin-top: 20px;
}

#wemd .multiquote-3 p {
  text-align: center;
}

#wemd .multiquote-3 h3 {
  text-align: center;
}

#wemd .table-of-contents a {
  border: none;
  color: black;
  font-weight: normal;
}

/* 链接 */
#wemd a {
  text-decoration: none;
  color: #1e6bb8;
  word-wrap: break-word;
  font-weight: bold;
  border-bottom: 1px solid #1e6bb8;
}

/* 加粗 */
#wemd strong {
  font-weight: bold;
  color: black;
}

/* 斜体 */
#wemd em {
  font-style: italic;
  color: black;
}

/* 加粗斜体 */
#wemd em strong {
  font-weight: bold;
  color: black;
}

/* 删除线 */
#wemd del {
  font-style: italic;
  color: black;
}

/* 分隔线 */
#wemd hr {
  height: 1px;
  margin: 0;
  margin-top: 10px;
  margin-bottom: 10px;
  border: none;
  border-top: 1px solid black;
}

/* 代码块 */
#wemd pre {
  margin-top: 10px;
  margin-bottom: 10px;
}
#wemd pre code {
  display: -webkit-box;
  font-family: Operator Mono, Consolas, Monaco, Menlo, monospace;
  border-radius: 0px;
  font-size: 12px;
  -webkit-overflow-scrolling: touch;
}
#wemd pre code span {
  line-height: 26px;
}

/* 行内代码 */
#wemd p code,
#wemd li code {
  font-size: 14px;
  word-wrap: break-word;
  padding: 2px 4px;
  border-radius: 4px;
  margin: 0 2px;
  color: #1e6bb8;
  background-color: rgba(27,31,35,.05);
  font-family: Operator Mono, Consolas, Monaco, Menlo, monospace;
  word-break: break-all;
}

/* 图片 */
#wemd img {
  display: block;
  margin: 0 auto;
  max-width: 100%;
}

/* 图片 */
#wemd figure {
  margin: 0;
  margin-top: 10px;
  margin-bottom: 10px;
}

/* 图片描述文字 */
#wemd figcaption {
  margin-top: 5px;
  text-align: center;
  color: #888;
  font-size: 14px;
}


/* 表格容器 */
#wemd .table-container{
  overflow-x: auto;
}

/* 表格 */
#wemd table {
  display: table;
  text-align: left;
}
#wemd tbody {
  border: 0;
}

#wemd table tr {
  border: 0;
  border-top: 1px solid #ccc;
  background-color: white;
}

#wemd table tr:nth-child(2n) {
  background-color: #F8F8F8;
}

#wemd table tr th,
#wemd table tr td {
  font-size: 16px;
  border: 1px solid #ccc;
  padding: 5px 10px;
  text-align: left;
}

#wemd table tr th {
  font-weight: bold;
  background-color: #f0f0f0;
}

/* 表格最小列宽4个汉字 */
#wemd table tr th:nth-of-type(n),
#wemd table tr td:nth-of-type(n){
  min-width:85px;
}

#wemd .footnote-word {
  color: #1e6bb8;
  font-weight: bold;
}

#wemd .footnote-ref {
  color: #1e6bb8;
  font-weight: bold;
}

#wemd .footnote-item {
  display: flex;
}

#wemd .footnote-num {
  display: inline;
  width: 10%; /*神奇，50px就不可以*/
  background: none;
  font-size: 80%;
  opacity: 0.6;
  line-height: 26px;
  font-family: ptima-Regular, Optima, PingFangSC-light, PingFangTC-light, 'PingFang SC', Cambria, Cochin, Georgia, Times, 'Times New Roman', serif;
}

#wemd .footnote-item p {
  display: inline;
  font-size: 14px;
  width: 90%;
  padding: 0px;
  margin: 0;
  line-height: 26px;
  color: black;
  word-break:break-all;
  width: calc(100%-50)
}

#wemd sub, sup {
  line-height: 0;
}

#wemd .footnotes-sep:before {
  content: "参考资料";
  display: block;
}

/* 解决公式问题 */
#wemd .block-equation {
  display:block;
  text-align: center;
  overflow: auto;
  display: block;
  -webkit-overflow-scrolling: touch;
}

#wemd .block-equation svg {
  max-width: 300% !important;
  -webkit-overflow-scrolling: touch;
}

#wemd .inline-equation {
}

#wemd .inline-equation svg {
}

#wemd .imageflow-layer1 {
  margin-top: 1em;
  margin-bottom: 0.5em;
  white-space: normal;
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
  vertical-align: middle;
  width: 100%;
}

#wemd .imageflow-img {
  display: inline-block;
}

#wemd .imageflow-caption {
  text-align: center;
  margin-top: 0px;
  padding-top: 0px;
  color: #888;
}

#wemd .nice-suffix-juejin-container {
  margin-top: 20px !important;
}

#wemd figure a {
  border: none;
}

#wemd figure a img {
  margin: 0px;
}

#wemd figure {
  display:flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

/* 图片链接嵌套 */
#wemd figure a {
  display: flex;
  justify-content: center;
  align-items: center;
}

/* 图片链接嵌套，图片解释 */
#wemd figure a + figcaption {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  margin-top: -35px;
  background: rgba(0,0,0,0.7);
  color: white;
  line-height: 35px;
  z-index: 20;
}
`;
