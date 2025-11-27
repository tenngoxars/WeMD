export const codeGithubTheme = `/*
github.com style (c) Vasily Polovnyov <vast@whiteants.net>
*/

/* 代码块样式 - 需要添加 #wemd 前缀以匹配包装后的 HTML */
#wemd .hljs {
  display: block;
  overflow-x: auto;
  padding: 16px;
  color: #333;
  background: #f8f8f8;
}

#wemd .hljs-comment,
#wemd .hljs-quote {
  color: #998;
  font-style: italic;
}

#wemd .hljs-keyword,
#wemd .hljs-selector-tag,
#wemd .hljs-subst {
  color: #333;
  font-weight: bold;
}

#wemd .hljs-number,
#wemd .hljs-literal,
#wemd .hljs-variable,
#wemd .hljs-template-variable,
#wemd .hljs-tag .hljs-attr {
  color: #008080;
}

#wemd .hljs-string,
#wemd .hljs-doctag {
  color: #d14;
}

#wemd .hljs-title,
#wemd .hljs-section,
#wemd .hljs-selector-id {
  color: #900;
  font-weight: bold;
}

#wemd .hljs-subst {
  font-weight: normal;
}

#wemd .hljs-type,
#wemd .hljs-class .hljs-title {
  color: #458;
  font-weight: bold;
}

#wemd .hljs-tag,
#wemd .hljs-name,
#wemd .hljs-attribute {
  color: #000080;
  font-weight: normal;
}

#wemd .hljs-regexp,
#wemd .hljs-link {
  color: #009926;
}

#wemd .hljs-symbol,
#wemd .hljs-bullet {
  color: #990073;
}

#wemd .hljs-built_in,
#wemd .hljs-builtin-name {
  color: #0086b3;
}

#wemd .hljs-meta {
  color: #999;
  font-weight: bold;
}

#wemd .hljs-deletion {
  background: #fdd;
}

#wemd .hljs-addition {
  background: #dfd;
}

#wemd .hljs-emphasis {
  font-style: italic;
}

#wemd .hljs-strong {
  font-weight: bold;
}
`;
