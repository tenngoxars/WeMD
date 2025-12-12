/**
 * MathJax 按需加载工具
 * 仅在检测到数学公式时才加载 MathJax，避免不必要的内存占用
 */

let mathJaxPromise: Promise<void> | null = null;
let isLoaded = false;

/**
 * 检测内容是否包含数学公式
 */
export function hasMathFormula(content: string): boolean {
    // 检测行内公式 $...$ 或行间公式 $$...$$
    return /\$[^$]+\$/.test(content);
}

/**
 * 动态加载 MathJax
 */
export function loadMathJax(): Promise<void> {
    if (isLoaded && window.MathJax) {
        return Promise.resolve();
    }

    if (mathJaxPromise) {
        return mathJaxPromise;
    }

    mathJaxPromise = new Promise((resolve, reject) => {
        // 配置 MathJax（使用 any 绕过配置对象的类型检查）
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).MathJax = {
            tex: {
                inlineMath: [['$', '$']],
                displayMath: [['$$', '$$']],
                tags: 'ams'
            },
            svg: {
                fontCache: 'global' // 使用全局缓存减少内存
            },
            options: {
                renderActions: {
                    addMenu: [0, '', '']
                }
            },
            startup: {
                ready: () => {
                    window.MathJax!.startup.defaultReady();
                    isLoaded = true;
                    resolve();
                }
            }
        };

        // 动态加载脚本
        const script = document.createElement('script');
        script.id = 'MathJax-script';
        script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js';
        script.async = true;
        script.onerror = () => {
            mathJaxPromise = null;
            reject(new Error('Failed to load MathJax'));
        };
        document.head.appendChild(script);
    });

    return mathJaxPromise;
}

/**
 * 渲染指定元素中的数学公式
 */
export async function typesetElement(element: Element): Promise<void> {
    if (!window.MathJax) {
        return;
    }

    try {
        window.MathJax.typesetClear([element]);
        await window.MathJax.typesetPromise([element]);
    } catch (err) {
        console.error('MathJax typeset error:', err);
    }
}

// 声明 MathJax 类型
declare global {
    interface Window {
        MathJax?: {
            startup: {
                defaultReady: () => void;
                ready?: () => void;
            };
            typesetClear: (elements: Element[]) => void;
            typesetPromise: (elements: Element[]) => Promise<void>;
        };
    }
}
