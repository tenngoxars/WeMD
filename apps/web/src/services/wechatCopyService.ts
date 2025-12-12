import toast from 'react-hot-toast';
import { processHtml, createMarkdownParser } from '@wemd/core';
import { hasMathFormula, loadMathJax } from '../utils/mathJaxLoader';

// 处理 MathJax 元素以适配微信（参考 legacy 实现，结合 DOM 和字符串处理）
function processMathJaxForWechat(element: HTMLElement): void {
    // 1. DOM 操作阶段：处理容器标签和 SVG 尺寸
    const mjxs = Array.from(element.getElementsByTagName('mjx-container'));

    for (const mjx of mjxs) {
        const htmlMjx = mjx as HTMLElement;
        if (!htmlMjx.hasAttribute('jax')) {
            continue;
        }

        const isBlock = htmlMjx.getAttribute('display') === 'true';
        const newTag = isBlock ? 'section' : 'span';
        const newEl = document.createElement(newTag);

        // 复制所有属性（除了被移除的）
        for (const attr of Array.from(htmlMjx.attributes)) {
            if (['jax', 'display', 'tabindex', 'ctxtmenu_counter'].includes(attr.name)) continue;
            newEl.setAttribute(attr.name, attr.value);
        }

        // 强制设置显示模式和样式
        newEl.style.cssText = htmlMjx.style.cssText;
        if (isBlock) {
            newEl.style.display = 'block';
            newEl.style.textAlign = 'center';
            newEl.style.margin = '1em 0';
        } else {
            newEl.style.display = 'inline-block';
            newEl.style.verticalAlign = 'middle';
            newEl.style.margin = '0 2px';
        }

        // 移动内容
        while (htmlMjx.firstChild) {
            newEl.appendChild(htmlMjx.firstChild);
        }

        // 处理 SVG 尺寸
        const svg = newEl.querySelector('svg');
        if (svg) {
            const width = svg.getAttribute('width');
            const height = svg.getAttribute('height');

            svg.removeAttribute('width');
            svg.removeAttribute('height');

            svg.style.display = 'block';
            svg.style.overflow = 'visible';
            if (width) svg.style.width = width;
            if (height) svg.style.height = height;
        }

        // 替换原元素
        htmlMjx.parentNode?.replaceChild(newEl, htmlMjx);
    }

    // 2. 字符串操作阶段：处理 SVG 内部样式和清理（复刻 Legacy 正则逻辑）
    let html = element.innerHTML;

    // 处理 .mjx-solid 类 (Legacy 关键步骤)
    html = html.replace(/class="mjx-solid"/g, 'fill="none" stroke-width="70"');

    // 移除辅助元素
    html = html.replace(/<mjx-assistive-mml.+?<\/mjx-assistive-mml>/g, "");

    // 修复行内公式后的空格 (Legacy 逻辑)
    html = html.replace(/svg><\/span>\s/g, "svg></span>&nbsp;");

    element.innerHTML = html;
}

export async function copyToWechat(markdown: string, css: string): Promise<void> {
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.top = '-9999px';
    container.style.left = '-9999px';
    document.body.appendChild(container);

    try {
        // Create parser synchronously
        const parser = createMarkdownParser();
        const rawHtml = parser.render(markdown);
        const styledHtml = processHtml(rawHtml, css);

        container.innerHTML = styledHtml;

        // 按需加载 MathJax：仅在内容包含公式时才加载和渲染
        if (hasMathFormula(markdown)) {
            try {
                await loadMathJax();
                if (window.MathJax) {
                    window.MathJax.typesetClear([container]);
                    await window.MathJax.typesetPromise([container]);
                }
            } catch (e) {
                console.error('MathJax rendering failed during copy:', e);
            }
        }

        // Process for WeChat (MathJax etc)
        processMathJaxForWechat(container);

        // Copy logic
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(container);
        selection?.removeAllRanges();
        selection?.addRange(range);

        document.execCommand('copy');

        // Modern API fallback/enhancement
        if (navigator.clipboard && window.ClipboardItem) {
            try {
                // We need inline styles for WeChat, which processHtml should have handled (juice)
                // But processHtml in @wemd/core might just wrap it.
                // Actually, processHtml in @wemd/core uses juice to inline styles.

                const blob = new Blob([container.innerHTML], { type: 'text/html' });
                const textBlob = new Blob([markdown], { type: 'text/plain' });
                await navigator.clipboard.write([
                    new ClipboardItem({
                        'text/html': blob,
                        'text/plain': textBlob
                    })
                ]);
            } catch (e) {
                console.error('Clipboard API failed, fallback used', e);
            }
        }

        toast.success('已复制，可以直接粘贴至微信公众号', {
            duration: 3000,
            icon: '✅',
        });
    } catch (error) {
        console.error('Copy failed:', error);
        toast.error('复制失败，请重试');
        throw error;
    } finally {
        document.body.removeChild(container);
    }
}
