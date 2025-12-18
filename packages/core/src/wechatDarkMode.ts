/**
 * 微信深色模式颜色转换引擎
 * 基于微信公众号 App 的原生渲染行为，实现 HSL 映射模型与对比度保全算法。
 */
type ElementType =
    | 'heading'
    | 'body'
    | 'background'
    | 'table'
    | 'table-text'
    | 'blockquote'
    | 'blockquote-text'
    | 'code'
    | 'code-text'
    | 'decorative-dark'
    | 'vibrant-protected'
    | 'selection'
    | 'selection-text'
    | 'other';
type CssNode =
    | { type: 'rule'; selector: string; body: string }
    | { type: 'atrule'; name: string; params: string; body: string; children: CssNode[]; isStandalone?: boolean };

/** 深色模式可配置参数 */
export interface DarkModeConfig {
    vibrantSaturationThreshold: number;
    vibrantLightnessRange: [number, number];
    decorativeDarkLuminanceThreshold: number;
}

const DEFAULT_CONFIG: DarkModeConfig = {
    vibrantSaturationThreshold: 15,
    vibrantLightnessRange: [35, 55],
    decorativeDarkLuminanceThreshold: 20
};

const CSS_KEYWORDS_SKIP = /^(currentcolor|inherit|transparent|initial|unset|none)$/i;
const DEFAULT_DARK_BG_COLOR_RGB = [25, 25, 25];
const CONVERSION_MARK = '/* wemd-wechat-dark-converted */';
const convertCssCache = new Map<string, string>();
const convertCssCacheQueue: string[] = [];
const CACHE_LIMIT = 200;

const hashCss = (css: string): string => {
    let hash = 0;
    for (let i = 0; i < css.length; i++) {
        hash = (hash * 31 + css.charCodeAt(i)) | 0;
    }
    return `${css.length}:${hash >>> 0}`;
};

const cacheSet = (key: string, value: string) => {
    if (convertCssCache.has(key)) return;
    convertCssCache.set(key, value);
    convertCssCacheQueue.push(key);
    if (convertCssCacheQueue.length > CACHE_LIMIT) {
        const oldKey = convertCssCacheQueue.shift();
        if (oldKey) convertCssCache.delete(oldKey);
    }
};

function hexToRgb(hex: string): [number, number, number] | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : null;
}

function rgbToHex(r: number, g: number, b: number): string {
    return '#' + [r, g, b].map(x => {
        const hex = Math.round(Math.max(0, Math.min(255, x))).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return [h * 360, s * 100, l * 100];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
    s /= 100; l /= 100; h /= 360;
    if (s === 0) return [l * 255, l * 255, l * 255];
    const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1; if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return [hue2rgb(p, q, h + 1 / 3) * 255, hue2rgb(p, q, h) * 255, hue2rgb(p, q, h - 1 / 3) * 255];
}

function calculateLuminance(rgb: number[]): number {
    return (299 * rgb[0] + 587 * rgb[1] + 114 * rgb[2]) / 1000;
}

function adjustToLuminance(targetLuminance: number, rgb: number[]): [number, number, number] {
    const currentLuminance = calculateLuminance(rgb);
    if (currentLuminance < 1e-3) return [targetLuminance, targetLuminance, targetLuminance];
    const ratio = targetLuminance / currentLuminance;
    let r = Math.min(255, rgb[0] * ratio), g = Math.min(255, rgb[1] * ratio), b = Math.min(255, rgb[2] * ratio);
    if (g === 0 || r === 255 || b === 255) {
        g = (1000 * targetLuminance - 299 * r - 114 * b) / 587;
    } else if (r === 0) {
        r = (1000 * targetLuminance - 587 * g - 114 * b) / 299;
    } else if (b === 0 || g === 255) {
        b = (1000 * targetLuminance - 299 * r - 587 * g) / 114;
    }
    return [Math.max(0, Math.min(255, r)), Math.max(0, Math.min(255, g)), Math.max(0, Math.min(255, b))];
}

function mapBackgroundRange(hsl: [number, number, number], minL: number, maxL: number, sFactor: number = 0.8): [number, number, number] {
    const [h, s, l] = hsl;
    const newL = maxL - (l / 100) * (maxL - minL);
    const newS = s > 5 ? s * sFactor : s;
    return hslToRgb(h, newS, newL);
}

function adjustBackgroundBrightness(rgb: number[], hsl: [number, number, number], type: ElementType = 'background', config: DarkModeConfig = DEFAULT_CONFIG): [number, number, number] {
    const [h, s, l] = hsl;
    const { vibrantSaturationThreshold, vibrantLightnessRange } = config;
    if (s > vibrantSaturationThreshold && l > 15 && l < 95) {
        return hslToRgb(h, s, Math.max(vibrantLightnessRange[0], Math.min(vibrantLightnessRange[1], l * 0.85)));
    }
    const ranges: Record<ElementType, { min: number; max: number; sFactor: number }> = {
        'body': { min: 10, max: 10, sFactor: 0 },
        'background': { min: 12, max: 18, sFactor: 0.5 },
        'table': { min: 10, max: 24, sFactor: 0.6 },
        'blockquote': { min: 14, max: 22, sFactor: 0.7 },
        'code': { min: 10, max: 20, sFactor: 0.5 },
        'heading': { min: 10, max: 10, sFactor: 0 },
        'selection': { min: 45, max: 65, sFactor: 0.6 },
        'blockquote-text': { min: 0, max: 0, sFactor: 0 },
        'table-text': { min: 0, max: 0, sFactor: 0 },
        'code-text': { min: 0, max: 0, sFactor: 0 },
        'selection-text': { min: 0, max: 0, sFactor: 0 },
        'decorative-dark': { min: 10, max: 15, sFactor: 0 },
        'vibrant-protected': { min: 35, max: 55, sFactor: 1 },
        'other': { min: 12, max: 20, sFactor: 0.7 }
    };
    const rangeConfig = ranges[type] || ranges['background'];
    if (type === 'table' && l > 85) {
        const factor = Math.pow((100 - l) / 15, 0.7);
        return hslToRgb(h, s * rangeConfig.sFactor, rangeConfig.min + factor * (rangeConfig.max - rangeConfig.min));
    }
    if (l < 15 && s > 8) return hslToRgb(h, s, 22);
    return mapBackgroundRange(hsl, rangeConfig.min, rangeConfig.max, rangeConfig.sFactor);
}

function adjustDecorativeDarkBrightness(rgb: number[], hsl: [number, number, number]): [number, number, number] {
    const [h, s, l] = hsl;
    return hslToRgb(h, s * 0.5, Math.max(10, Math.min(15, l)));
}

function adjustBlockquoteTextBrightness(textRgb: number[], textHsl: [number, number, number]): [number, number, number] {
    const [h, s, l] = textHsl;
    return hslToRgb(h, s * 0.4, Math.max(75, Math.min(85, 100 - l * 0.2)));
}

function adjustTableTextBrightness(textRgb: number[], textHsl: [number, number, number]): [number, number, number] {
    const [h, s, l] = textHsl;
    return hslToRgb(h, s > 15 ? s * 0.8 : s * 0.4, Math.max(78, Math.min(88, 100 - l * 0.22)));
}

function adjustTextBrightness(textRgb: number[], textHsl: [number, number, number], bgRgb: number[] = DEFAULT_DARK_BG_COLOR_RGB): [number, number, number] {
    const [h, s, l] = textHsl;
    const bgL = calculateLuminance(bgRgb), textL = calculateLuminance(textRgb);
    if (textL > 220) return [textRgb[0], textRgb[1], textRgb[2]];
    const minL = bgL + 65, maxL = bgL + 180;
    if (textL >= minL && textL <= maxL) return [textRgb[0], textRgb[1], textRgb[2]];
    return adjustToLuminance(minL + (l / 100) * (maxL - minL), textRgb);
}

function adjustCodeTextBrightness(textRgb: number[], textHsl: [number, number, number]): [number, number, number] {
    const [h, s, l] = textHsl;
    if (l > 70) return adjustToLuminance(Math.max(200, calculateLuminance(textRgb)), textRgb);
    return hslToRgb(h, Math.min(100, s * 1.1 + 5), 78);
}

function stripComments(css: string): string {
    return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function isEscaped(str: string, index: number): boolean {
    let backslashes = 0;
    for (let i = index - 1; i >= 0; i--) {
        if (str[i] === '\\') backslashes++;
        else break;
    }
    return backslashes % 2 === 1;
}

function findMatchingBrace(str: string, start: number): number {
    let depth = 0;
    let inSingle = false, inDouble = false;
    for (let i = start; i < str.length; i++) {
        const ch = str[i];
        if (ch === "'" && !inDouble && !isEscaped(str, i)) inSingle = !inSingle;
        if (ch === '"' && !inSingle && !isEscaped(str, i)) inDouble = !inDouble;
        if (inSingle || inDouble) continue;
        if (ch === '{') depth++;
        else if (ch === '}') {
            depth--;
            if (depth === 0) return i;
        }
    }
    return -1;
}

function splitDeclarations(body: string): string[] {
    const decls: string[] = [];
    let buf = '';
    let depth = 0;
    let inSingle = false, inDouble = false;
    for (let i = 0; i < body.length; i++) {
        const ch = body[i];
        if (ch === "'" && !inDouble && !isEscaped(body, i)) {
            inSingle = !inSingle;
            buf += ch;
            continue;
        }
        if (ch === '"' && !inSingle && !isEscaped(body, i)) {
            inDouble = !inDouble;
            buf += ch;
            continue;
        }
        if (inSingle || inDouble) {
            buf += ch;
            continue;
        }
        if (ch === '(') depth++;
        else if (ch === ')') depth = Math.max(0, depth - 1);
        if (ch === ';' && depth === 0) {
            if (buf.trim()) decls.push(buf.trim());
            buf = '';
            continue;
        }
        buf += ch;
    }
    if (buf.trim()) decls.push(buf.trim());
    return decls;
}

function parseCssBlocks(css: string): CssNode[] {
    const nodes: CssNode[] = [];
    let i = 0;
    const len = css.length;
    while (i < len) {
        while (i < len && /\s/.test(css[i])) i++;
        if (i >= len) break;
        const start = i;
        if (css[i] === '@') {
            while (i < len && css[i] !== '{' && css[i] !== ';') i++;
            const prelude = css.slice(start, i).trim();
            if (css[i] === ';') {
                nodes.push({ type: 'atrule', name: prelude, params: '', body: '', children: [], isStandalone: true });
                i++;
                continue;
            }
            const braceStart = i;
            const braceEnd = findMatchingBrace(css, braceStart);
            if (braceEnd === -1) break;
            const inner = css.slice(braceStart + 1, braceEnd);
            const children = parseCssBlocks(inner);
            nodes.push({
                type: 'atrule',
                name: prelude,
                params: '',
                body: children.length ? '' : inner,
                children
            });
            i = braceEnd + 1;
        } else {
            while (i < len && css[i] !== '{') i++;
            const selector = css.slice(start, i).trim();
            const braceStart = i;
            if (braceStart >= len || css[braceStart] !== '{') {
                const remaining = css.slice(start).trim();
                if (remaining) nodes.push({ type: 'rule', selector: '*', body: remaining });
                break;
            }
            const braceEnd = findMatchingBrace(css, braceStart);
            if (braceEnd === -1) break;
            const body = css.slice(braceStart + 1, braceEnd);
            nodes.push({ type: 'rule', selector, body });
            i = braceEnd + 1;
        }
    }
    return nodes;
}

function getElementType(selector: string): ElementType {
    const lower = selector.toLowerCase();
    if (/::selection/.test(lower)) return 'selection';
    if (/::(before|after|marker|backdrop|placeholder)/.test(lower)) return 'decorative-dark';
    const sanitized = lower
        .replace(/:not\(([^)]*)\)/g, '$1')
        .replace(/:[:]?[\w-]+(\([^)]*\))?/g, '')
        .trim();
    const target = sanitized || lower;
    if (/\b(blockquote|callout|multiquote|tip|note|warning|danger|success|info|caution|card|paper|footnote|custom-block|imageflow-caption)\b/.test(lower)) return 'blockquote';
    if (/\b(pre|code|hljs|language-)/.test(target)) return 'code';
    if (/\b(table|tr|th|td|theader)\b/.test(target)) return 'table';
    if (/\bh[1-6]\b/.test(target)) return 'heading';
    if (/\bp\b|\bli\b|\bsection\b|\bspan\b/.test(target)) return 'body';
    if (/background|bg-|color-/.test(target)) return 'background';
    return 'other';
}

function processColorRgb(rgb: number[], type: ElementType): [number, number, number] {
    const hsl = rgbToHsl(rgb[0], rgb[1], rgb[2]);
    const isBg = ['background', 'table', 'blockquote', 'code', 'vibrant-protected'].includes(type);
    if (isBg) return adjustBackgroundBrightness(rgb, hsl, type);
    if (type === 'decorative-dark') return adjustDecorativeDarkBrightness(rgb, hsl);
    if (type === 'table-text') return adjustTableTextBrightness(rgb, hsl);
    if (type === 'code-text') return adjustCodeTextBrightness(rgb, hsl);
    if (type === 'blockquote-text') return adjustBlockquoteTextBrightness(rgb, hsl);
    return adjustTextBrightness(rgb, hsl);
}

export function convertToWeChatDarkMode(hex: string, type: ElementType = 'body'): string {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;
    const [r, g, b] = processColorRgb(rgb, type);
    return rgbToHex(r, g, b);
}

function convertColorValue(raw: string, type: ElementType): string {
    const lower = raw.toLowerCase();
    if (lower.includes('var(') || lower.includes('gradient') || CSS_KEYWORDS_SKIP.test(lower.trim())) return raw;
    let res = raw.replace(/#([0-9a-fA-F]{3,8})\b/g, m => {
        let hex = m;
        if (m.length === 4) hex = '#' + m[1] + m[1] + m[2] + m[2] + m[3] + m[3];
        if (m.length === 5 || m.length === 9) {
            hex = hex.slice(0, 7);
        }
        return convertToWeChatDarkMode(hex, type);
    });

    const rgbPattern = /rgba?\(\s*([^)]+)\)/gi;
    res = res.replace(rgbPattern, (m, body) => {
        const parts = body.split(',').map((p: string) => p.trim());
        if (parts.length < 3) return m;
        const [r, g, b] = parts.slice(0, 3).map(parseFloat);
        const a = parts[3] !== undefined ? parseFloat(parts[3]) : 1;
        if ([r, g, b].some((n) => Number.isNaN(n))) return m;
        const [nr, ng, nb] = processColorRgb([r, g, b], type);
        return a < 1 ? `rgba(${Math.round(nr)}, ${Math.round(ng)}, ${Math.round(nb)}, ${a})` : `rgb(${Math.round(nr)}, ${Math.round(ng)}, ${Math.round(nb)})`;
    });

    const hslPattern = /hsla?\(\s*([^)]+)\)/gi;
    res = res.replace(hslPattern, (m, body) => {
        const parts = body.split(',').map((p: string) => p.trim().replace('%', ''));
        if (parts.length < 3) return m;
        const [h, s, l] = parts.slice(0, 3).map(parseFloat);
        const a = parts[3] !== undefined ? parseFloat(parts[3]) : 1;
        if ([h, s, l].some((n) => Number.isNaN(n))) return m;
        const [nr, ng, nb] = processColorRgb(hslToRgb(h, s, l), type);
        return a < 1 ? `rgba(${Math.round(nr)}, ${Math.round(ng)}, ${Math.round(nb)}, ${a})` : `rgb(${Math.round(nr)}, ${Math.round(ng)}, ${Math.round(nb)})`;
    });

    return res;
}

function transformDeclarations(selector: string, props: string): string {
    const baseType = getElementType(selector);
    const lowerSelector = selector.toLowerCase();
    const isCode = /\b(pre|code|hljs|language-)/.test(lowerSelector);
    const decls = splitDeclarations(props);
    const rebuilt: string[] = [];

    for (const decl of decls) {
        const colonIndex = decl.indexOf(':');
        if (colonIndex === -1) {
            rebuilt.push(decl);
            continue;
        }
        const name = decl.slice(0, colonIndex).trim();
        const val = decl.slice(colonIndex + 1).trim();
        if (!name || !val) {
            rebuilt.push(decl);
            continue;
        }

        const lowerName = name.toLowerCase();
        if (val.toLowerCase().includes('url(')) {
            rebuilt.push(`${name}: ${val}`);
            continue;
        }

        const isBg = /background|bgcolor/i.test(name);
        const isText = lowerName === 'color';
        const isShadow = /shadow/i.test(name);
        const isBorder = /border|outline/i.test(name);

        let type: ElementType = baseType;

        if (isBg) {
            type = baseType === 'table' ? 'table' : baseType === 'blockquote' ? 'blockquote' : baseType === 'selection' ? 'selection' : (baseType === 'code' || isCode ? 'code' : 'background');
        } else if (isShadow || isBorder) {
            const colorMatch = val.match(/#([0-9a-fA-F]{3,8})|rgba?\(\s*([^)]+)\)/i);
            if (colorMatch) {
                let rgb: [number, number, number] | null = null;
                if (colorMatch[1]) {
                    const h = colorMatch[1];
                    const hex = h.length === 3 ? '#' + h[0] + h[0] + h[1] + h[1] + h[2] + h[2] : '#' + h.slice(0, 6);
                    rgb = hexToRgb(hex);
                } else if (colorMatch[2]) {
                    const parts = colorMatch[2].split(',').map(p => parseFloat(p.trim()));
                    if (parts.length >= 3) rgb = [parts[0], parts[1], parts[2]];
                }

                if (rgb) {
                    const lum = calculateLuminance(rgb);
                    const [, s] = rgbToHsl(rgb[0], rgb[1], rgb[2]);
                    if (lum < 20) type = 'decorative-dark';
                    else if (s > 15) type = 'vibrant-protected';
                    else type = baseType === 'table' ? 'table-text' : baseType === 'blockquote' ? 'blockquote-text' : baseType === 'selection' ? 'selection-text' : (baseType === 'code' || isCode ? 'code-text' : baseType);
                } else {
                    type = baseType === 'table' ? 'table-text' : baseType === 'blockquote' ? 'blockquote-text' : baseType === 'selection' ? 'selection-text' : (baseType === 'code' || isCode ? 'code-text' : baseType);
                }
            } else {
                type = baseType === 'table' ? 'table-text' : baseType === 'blockquote' ? 'blockquote-text' : baseType === 'selection' ? 'selection-text' : (baseType === 'code' || isCode ? 'code-text' : baseType);
            }
        } else if (isText) {
            type = baseType === 'table' ? 'table-text' : baseType === 'blockquote' ? 'blockquote-text' : baseType === 'selection' ? 'selection-text' : (baseType === 'code' || isCode ? 'code-text' : baseType);
        }

        rebuilt.push(`${name}: ${convertColorValue(val, type)}`);
    }

    return `${selector}{${rebuilt.join(';')}}`;
}

function convertCssInternal(css: string): string {
    const cleaned = stripComments(css);
    const nodes = parseCssBlocks(cleaned);

    const renderNodes = (items: CssNode[]): string => {
        return items.map((node) => {
            if (node.type === 'rule') {
                return transformDeclarations(node.selector, node.body);
            }
            if (node.isStandalone) {
                return `${node.name};`;
            }
            if (node.children.length) {
                return `${node.name}{${renderNodes(node.children)}}`;
            }
            const body = node.body.trim();
            if (body) {
                return `${node.name}{${transformDeclarations(node.name, body)}}`;
            }
            return `${node.name}{}`;
        }).join('');
    };

    const res = renderNodes(nodes);
    return `${CONVERSION_MARK}\n${res}`;
}

export function convertCssToWeChatDarkMode(css: string): string {
    if (css.includes(CONVERSION_MARK)) return css;
    const key = hashCss(css);
    const cached = convertCssCache.get(key);
    if (cached) return cached;
    const res = convertCssInternal(css);
    cacheSet(key, res);
    return res;
}

export { convertCssInternal as _convertCssToWeChatDarkModeInternal };
