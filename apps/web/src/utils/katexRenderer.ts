/**
 * KaTeX 轻量级数学公式渲染工具
 * 用于实时预览，速度快，内存占用低
 */
import katex from 'katex';
import 'katex/dist/katex.min.css';

/**
 * 检测内容是否包含数学公式
 */
export function hasMathFormula(content: string): boolean {
    // 检测行内公式 $...$ 或行间公式 $$...$$
    return /\$[^$]+\$/.test(content);
}

/**
 * 渲染元素中的数学公式
 * 查找所有 $ 包裹的内容并用 KaTeX 渲染
 */
export function renderMathInElement(element: HTMLElement): void {
    if (!element) return;

    // 获取所有文本节点
    const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        null
    );

    const textNodes: Text[] = [];
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
        if (node.textContent && /\$[^$]+\$/.test(node.textContent)) {
            textNodes.push(node);
        }
    }

    // 处理每个包含公式的文本节点
    for (const textNode of textNodes) {
        const text = textNode.textContent || '';
        const parent = textNode.parentNode;
        if (!parent) continue;

        // 跳过已经渲染过的节点
        if (parent instanceof HTMLElement && parent.classList.contains('katex')) {
            continue;
        }

        // 创建文档片段
        const fragment = document.createDocumentFragment();
        let lastIndex = 0;

        // 匹配行间公式 $$...$$ 和行内公式 $...$
        const regex = /\$\$([^$]+)\$\$|\$([^$]+)\$/g;
        let match: RegExpExecArray | null;

        while ((match = regex.exec(text)) !== null) {
            // 添加公式前的普通文本
            if (match.index > lastIndex) {
                fragment.appendChild(
                    document.createTextNode(text.slice(lastIndex, match.index))
                );
            }

            // 渲染公式
            const isBlock = match[1] !== undefined;
            const formula = isBlock ? match[1] : match[2];
            const wrapper = document.createElement(isBlock ? 'div' : 'span');
            wrapper.className = isBlock ? 'katex-block' : 'katex-inline';

            try {
                katex.render(formula.trim(), wrapper, {
                    throwOnError: false,
                    displayMode: isBlock,
                });
            } catch (e) {
                wrapper.textContent = match[0]; // 渲染失败时保留原文
                wrapper.className = 'katex-error';
            }

            fragment.appendChild(wrapper);
            lastIndex = match.index + match[0].length;
        }

        // 添加剩余的普通文本
        if (lastIndex < text.length) {
            fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
        }

        // 替换原节点
        if (fragment.childNodes.length > 0) {
            parent.replaceChild(fragment, textNode);
        }
    }
}
