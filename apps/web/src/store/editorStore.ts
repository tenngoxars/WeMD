import { create } from 'zustand';
import { basicTheme, customDefaultTheme, codeGithubTheme } from '@wemd/core';
import toast from 'react-hot-toast';

// 常量定义
const PREVIEW_SELECTOR = '.preview-content > div';
const DATA_TOOL = 'WeMD编辑器';
const DATA_WEBSITE = 'https://github.com/your-repo/wemd';

interface EditorStore {
  markdown: string;
  setMarkdown: (markdown: string) => void;

  theme: string;
  setTheme: (theme: string) => void;

  customCSS: string;
  setCustomCSS: (css: string) => void;
  getThemeCSS: (theme: string) => string;

  copyToWechat: () => void;
}

const defaultMarkdown = `# 欢迎使用 WeMD

这是一个现代化的 Markdown 编辑器，专为**微信公众号**排版设计。

## 1. 标题演示
# 一级标题
## 二级标题
### 三级标题
#### 四级标题

## 2. 文本样式
**这是加粗文本**
*这是斜体文本*
***这是加粗斜体文本***
~~这是删除线文本~~
这是一个 [链接](https://github.com/your-repo)

## 3. 列表展示
### 无序列表
- 列表项 1
- 列表项 2
  - 嵌套列表项 2.1
  - 嵌套列表项 2.2

### 有序列表
1. 第一步
2. 第二步
3. 第三步

## 4. 引用
> 这是一个一级引用
> 
> > 这是一个二级引用
> > 
> > > 这是一个三级引用

## 5. 代码展示
### 行内代码
我们在代码中通常使用 \`console.log()\` 来输出信息。

### 代码块
\`\`\`javascript
// JavaScript 示例
function hello() {
  console.log('Hello, WeMD!');
  const a = 1;
  const b = 2;
  return a + b;
}
\`\`\`

## 6. 数学公式
行内公式: $E=mc^2$

行间公式:
$$
\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}
$$

## 7. 表格
| 姓名 | 年龄 | 职业 |
| :--- | :---: | ---: |
| 张三 | 18 | 工程师 |
| 李四 | 20 | 设计师 |
| 王五 | 22 | 产品经理 |

## 8. 分割线
---

## 9. 图片
![WeMD](https://via.placeholder.com/400x200?text=WeMD)

**开始编辑吧!** 🚀
`;

export const useEditorStore = create<EditorStore>((set, get) => ({
  markdown: defaultMarkdown,
  setMarkdown: (markdown) => set({ markdown }),

  theme: 'default',
  setTheme: (theme) => set({ theme }),

  customCSS: '',
  setCustomCSS: (css) => set({ customCSS: css }),

  getThemeCSS: (theme: string) => {
    const { customCSS } = get();
    // 如果有自定义 CSS，使用自定义的，但始终追加代码高亮主题
    // 这样自定义主题也能有代码语法高亮
    if (customCSS) {
      return customCSS + '\n' + codeGithubTheme;
    }
    return getThemeCSS(theme);
  },

  copyToWechat: async () => {
    try {
      // 1. 获取预览区域的 DOM 元素 (包含已渲染的 MathJax 公式)
      const previewContent = document.querySelector(PREVIEW_SELECTOR) as HTMLElement;
      if (!previewContent) {
        throw new Error('找不到预览节点');
      }

      // 2. 克隆节点以进行处理，避免影响页面显示
      const clone = previewContent.cloneNode(true) as HTMLElement;

      // 3. 处理 MathJax (提取为独立函数以提高可读性)
      processMathJaxForWechat(clone);

      // 4. 获取 HTML 字符串并确保属性正确
      let html = clone.innerHTML;
      html = ensureSectionAttributes(html);

      // 5. 使用现代 Clipboard API (如果支持)
      if (navigator.clipboard && window.ClipboardItem) {
        try {
          const blob = new Blob([html], { type: 'text/html' });
          const clipboardItem = new ClipboardItem({ 'text/html': blob });
          await navigator.clipboard.write([clipboardItem]);
          
          // 同时设置纯文本格式
          await navigator.clipboard.writeText(get().markdown);
          
          toast.success('已复制!可以直接粘贴到微信公众号编辑器了', {
            duration: 3000,
            icon: '✅',
          });
          return;
        } catch (clipboardError) {
          // 如果现代 API 失败，回退到传统方法
          console.warn('现代 Clipboard API 失败，使用传统方法:', clipboardError);
        }
      }

      // 6. 回退到传统复制方法
      fallbackCopyToClipboard(html, get().markdown);

    } catch (error) {
      console.error('复制失败:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      toast.error(`复制失败: ${errorMessage}`, {
        duration: 3000,
      });
    }
  },
}));

// 获取主题 CSS
function getThemeCSS(theme: string): string {
  switch (theme) {
    default:
      // 组合 basicTheme (基础重置), customDefaultTheme (自定义样式) 和 codeGithubTheme (代码高亮)
      return basicTheme + '\n' + customDefaultTheme + '\n' + codeGithubTheme;
  }
}

// 处理 MathJax 元素以适配微信
function processMathJaxForWechat(element: HTMLElement): void {
  const mjxs = element.getElementsByTagName('mjx-container');
  for (let i = 0; i < mjxs.length; i++) {
    const mjx = mjxs[i];
    if (!mjx.hasAttribute('jax')) {
      continue;
    }

    // 移除多余属性
    mjx.removeAttribute('jax');
    mjx.removeAttribute('display');
    mjx.removeAttribute('tabindex');
    mjx.removeAttribute('ctxtmenu_counter');

    // 处理 SVG 尺寸
    const svg = mjx.firstChild as HTMLElement;
    if (svg && svg.tagName.toLowerCase() === 'svg') {
      const width = svg.getAttribute('width');
      const height = svg.getAttribute('height');
      svg.removeAttribute('width');
      svg.removeAttribute('height');
      if (width) svg.style.width = width;
      if (height) svg.style.height = height;
    }
  }
}

// 确保 section#wemd 有正确的属性
function ensureSectionAttributes(html: string): string {
  const sectionMatch = html.match(/<section id="wemd"([^>]*)>/);
  if (sectionMatch) {
    let attrs = sectionMatch[1] || '';
    if (!attrs.includes('data-tool')) {
      attrs += ` data-tool="${DATA_TOOL}"`;
    }
    if (!attrs.includes('data-website')) {
      attrs += ` data-website="${DATA_WEBSITE}"`;
    }
    return html.replace(/<section id="wemd"[^>]*>/, `<section id="wemd"${attrs}>`);
  }
  // 如果没有 section，包装一个（这种情况不应该发生，但为了兼容性保留）
  return `<section id="wemd" data-tool="${DATA_TOOL}" data-website="${DATA_WEBSITE}">${html}</section>`;
}

// 传统复制方法（回退方案）
function fallbackCopyToClipboard(html: string, plainText: string): void {
  const input = document.createElement('div');
  input.id = 'copy-input';
  input.innerHTML = html;
  input.style.position = 'fixed';
  input.style.left = '-9999px';
  input.style.zIndex = '-9999';
  document.body.appendChild(input);

  const listener = (e: ClipboardEvent) => {
    e.preventDefault();
    if (e.clipboardData) {
      e.clipboardData.setData('text/html', html);
      e.clipboardData.setData('text/plain', plainText);
    }
  };

  document.addEventListener('copy', listener);

  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(input);
  selection?.removeAllRanges();
  selection?.addRange(range);

  const success = document.execCommand('copy');

  document.removeEventListener('copy', listener);
  document.body.removeChild(input);
  selection?.removeAllRanges();

  if (success) {
    toast.success('已复制!可以直接粘贴到微信公众号编辑器了', {
      duration: 3000,
      icon: '✅',
    });
  } else {
    throw new Error('execCommand copy failed');
  }
}
