/**
 * 微信复制 DOM 容器规范化
 * 处理微信公众号编辑器对粘贴 HTML 的清洗兼容问题：
 * - root section → div 转换
 * - 元数据属性清理
 * - 根节点 padding 迁移到内层元素
 * - 背景色下沉到子块
 */

// ── 颜色透明度判断 ──────────────────────────────────

const parseAlpha = (token: string): number | null => {
  const trimmed = token.trim();
  if (!trimmed) return null;

  if (trimmed.endsWith("%")) {
    const percent = Number.parseFloat(trimmed.slice(0, -1));
    return Number.isFinite(percent) ? percent / 100 : null;
  }

  const value = Number.parseFloat(trimmed);
  return Number.isFinite(value) ? value : null;
};

const getFunctionalColorAlpha = (normalized: string): number | null => {
  const match = normalized.match(/^(rgba?|hsla?)\((.*)\)$/);
  if (!match) return null;

  const fnName = match[1];
  const body = match[2].trim();

  if (body.includes("/")) {
    const slashIndex = body.lastIndexOf("/");
    const alphaToken = body.slice(slashIndex + 1);
    return parseAlpha(alphaToken);
  }

  if (fnName === "rgba" || fnName === "hsla") {
    const commaParts = body.split(",");
    if (commaParts.length === 4) {
      return parseAlpha(commaParts[3]);
    }
  }

  return null;
};

const isTransparentBackground = (value: string): boolean => {
  const normalized = value.replace(/\s+/g, "").toLowerCase();
  if (normalized === "transparent" || normalized.startsWith("transparent")) {
    return true;
  }

  // #RGBA / #RRGGBBAA
  if (/^#[0-9a-f]{4}$/.test(normalized)) {
    return normalized[4] === "0";
  }
  if (/^#[0-9a-f]{8}$/.test(normalized)) {
    return normalized.slice(6, 8) === "00";
  }

  const alpha = getFunctionalColorAlpha(normalized);
  return alpha !== null && alpha <= 0;
};

const hasExplicitBackgroundImage = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;

  if (/^none(\s*,\s*none)*$/.test(normalized)) return false;
  if (
    normalized === "initial" ||
    normalized === "inherit" ||
    normalized === "unset" ||
    normalized === "revert" ||
    normalized === "revert-layer"
  ) {
    return false;
  }

  return true;
};

const DEFAULT_COPY_TEXT_COLOR = "#1a1a1a";

const isUnresolvedColorValue = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return true;

  if (
    normalized === "inherit" ||
    normalized === "initial" ||
    normalized === "unset" ||
    normalized === "revert" ||
    normalized === "revert-layer" ||
    normalized === "currentcolor"
  ) {
    return true;
  }

  return (
    normalized.includes("var(") ||
    normalized.includes("color-mix(") ||
    normalized.includes("oklch(") ||
    normalized.includes("oklab(") ||
    normalized.includes("lab(") ||
    normalized.includes("lch(")
  );
};

const hasDirectTextContent = (element: HTMLElement): boolean => {
  return Array.from(element.childNodes).some((node) => {
    return node.nodeType === Node.TEXT_NODE && (node.textContent || "").trim();
  });
};

const materializeTextColorForWechat = (container: HTMLElement): void => {
  const root = container.firstElementChild;
  if (!(root instanceof HTMLElement)) return;

  const rootColorRaw = root.style.getPropertyValue("color").trim();
  const baseColor = isUnresolvedColorValue(rootColorRaw)
    ? DEFAULT_COPY_TEXT_COLOR
    : rootColorRaw;

  const walk = (node: HTMLElement, inheritedColor: string) => {
    const ownColorRaw = node.style.getPropertyValue("color").trim();
    const ownColor = isUnresolvedColorValue(ownColorRaw) ? null : ownColorRaw;
    const effectiveColor = ownColor || inheritedColor;

    if (hasDirectTextContent(node) && ownColor !== effectiveColor) {
      node.style.setProperty("color", effectiveColor);
    }

    const children = Array.from(node.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement,
    );
    children.forEach((child) => walk(child, effectiveColor));
  };

  walk(root, baseColor);
};

// ── 间距工具函数 ────────────────────────────────────

const isZeroSpacing = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return true;
  if (normalized === "0" || normalized === "0px" || normalized === "0%") {
    return true;
  }
  return normalized.split(/\s+/).every((token) => {
    return token === "0" || token === "0px" || token === "0%";
  });
};

const mergeHorizontalPadding = (
  existingPadding: string,
  rootPadding: string,
): string => {
  const normalized = existingPadding.trim().toLowerCase();
  if (
    normalized === "auto" ||
    normalized === "inherit" ||
    normalized === "initial" ||
    normalized === "unset" ||
    normalized === "revert" ||
    normalized === "revert-layer"
  ) {
    // 这些关键字无法与长度通过 calc 相加，回退为根节点留白值。
    return rootPadding;
  }
  if (isZeroSpacing(existingPadding)) {
    return rootPadding;
  }
  return `calc(${existingPadding} + ${rootPadding})`;
};

// ── DOM 变换 ────────────────────────────────────────

const transformWemdRootSectionToDiv = (container: HTMLElement): void => {
  const root = container.firstElementChild;
  if (
    !(root instanceof HTMLElement) ||
    root.tagName !== "SECTION" ||
    root.id !== "wemd" ||
    container.childElementCount !== 1
  ) {
    return;
  }

  const wrapper = document.createElement("div");
  Array.from(root.attributes).forEach((attr) => {
    wrapper.setAttribute(attr.name, attr.value);
  });
  while (root.firstChild) {
    wrapper.appendChild(root.firstChild);
  }
  container.replaceChildren(wrapper);
};

export const stripCopyMetadata = (container: HTMLElement): void => {
  const root = container.firstElementChild;
  if (root instanceof HTMLElement && root.id === "wemd") {
    root.removeAttribute("id");
  }

  container.querySelectorAll<HTMLElement>("[data-tool]").forEach((node) => {
    node.removeAttribute("data-tool");
  });

  container
    .querySelectorAll<HTMLElement>("[data-wemd-counter-generated]")
    .forEach((node) => {
      node.removeAttribute("data-wemd-counter-generated");
    });
};

// ── Padding 迁移 ───────────────────────────────────

const isHeadingElement = (node: HTMLElement): boolean => {
  const tagName = node.tagName;
  return (
    tagName === "H1" ||
    tagName === "H2" ||
    tagName === "H3" ||
    tagName === "H4" ||
    tagName === "H5" ||
    tagName === "H6"
  );
};

/**
 * 判断元素是否应使用 margin 而非 padding 迁移水平留白。
 * 含 border / background 的块级元素（标题、引用、代码块、提示块）需用 margin，
 * 否则 padding 只会把内容往里推，边框和背景仍贴在容器边缘。
 */
const shouldUseMarginForHorizontalOffset = (node: HTMLElement): boolean => {
  if (isHeadingElement(node)) return true;
  const tagName = node.tagName;
  if (tagName === "BLOCKQUOTE") return true;
  if (tagName === "PRE") return true;
  if (node.classList.contains("callout")) return true;
  return false;
};

/**
 * 微信编辑器会清理粘贴内容最外层元素的 padding。
 * 复制前将根节点 padding 迁移到内层包裹元素，确保页面左右留白生效。
 */
const relocateRootPaddingToInnerWrapper = (container: HTMLElement): void => {
  const root = container.firstElementChild;
  if (!(root instanceof HTMLElement)) return;

  const paddingLeft = root.style.getPropertyValue("padding-left").trim();
  const paddingRight = root.style.getPropertyValue("padding-right").trim();
  const paddingTop = root.style.getPropertyValue("padding-top").trim();
  const paddingBottom = root.style.getPropertyValue("padding-bottom").trim();

  const hasHorizontalPadding =
    !isZeroSpacing(paddingLeft) || !isZeroSpacing(paddingRight);
  const hasVerticalPadding =
    !isZeroSpacing(paddingTop) || !isZeroSpacing(paddingBottom);

  if (!hasHorizontalPadding && !hasVerticalPadding) {
    return;
  }

  const elementChildren = Array.from(root.children).filter(
    (node): node is HTMLElement => node instanceof HTMLElement,
  );

  // 左右留白优先下沉到一级内容块，避免微信清洗外层容器 padding。
  if (hasHorizontalPadding && elementChildren.length > 0) {
    elementChildren.forEach((child) => {
      const useMarginForHorizontalOffset =
        shouldUseMarginForHorizontalOffset(child);
      if (!isZeroSpacing(paddingLeft)) {
        if (useMarginForHorizontalOffset) {
          const existingMarginLeft = child.style
            .getPropertyValue("margin-left")
            .trim();
          child.style.setProperty(
            "margin-left",
            mergeHorizontalPadding(existingMarginLeft, paddingLeft),
          );
        } else {
          const existingPaddingLeft = child.style
            .getPropertyValue("padding-left")
            .trim();
          child.style.setProperty(
            "padding-left",
            mergeHorizontalPadding(existingPaddingLeft, paddingLeft),
          );
        }
      }
      if (!isZeroSpacing(paddingRight)) {
        if (useMarginForHorizontalOffset) {
          const existingMarginRight = child.style
            .getPropertyValue("margin-right")
            .trim();
          child.style.setProperty(
            "margin-right",
            mergeHorizontalPadding(existingMarginRight, paddingRight),
          );
        } else {
          const existingPaddingRight = child.style
            .getPropertyValue("padding-right")
            .trim();
          child.style.setProperty(
            "padding-right",
            mergeHorizontalPadding(existingPaddingRight, paddingRight),
          );
        }
      }
    });
  }

  // 仅当存在垂直 padding 时，才额外包一层承接上下留白。
  if (hasVerticalPadding) {
    const innerWrapper = document.createElement("div");
    innerWrapper.style.display = "block";
    innerWrapper.style.width = "100%";
    innerWrapper.style.boxSizing = "border-box";

    if (!isZeroSpacing(paddingTop)) {
      innerWrapper.style.setProperty("padding-top", paddingTop);
    }
    if (!isZeroSpacing(paddingBottom)) {
      innerWrapper.style.setProperty("padding-bottom", paddingBottom);
    }

    while (root.firstChild) {
      innerWrapper.appendChild(root.firstChild);
    }
    root.appendChild(innerWrapper);
  }

  root.style.removeProperty("padding");
  root.style.removeProperty("padding-left");
  root.style.removeProperty("padding-right");
  root.style.removeProperty("padding-top");
  root.style.removeProperty("padding-bottom");
};

// ── 背景色下沉 ─────────────────────────────────────

/**
 * 提取根元素的背景色并从根元素上移除。
 * 微信会清洗最外层容器样式，因此背景色需要下沉到子块。
 * 返回有效（非透明）的背景色字符串，无则返回 null。
 */
const extractRootBackgroundColor = (container: HTMLElement): string | null => {
  const root = container.firstElementChild;
  if (!(root instanceof HTMLElement)) return null;

  const background = root.style.getPropertyValue("background");
  const backgroundColor = root.style.getPropertyValue("background-color");

  // 找出有效的非透明背景色
  let effectiveBg: string | null = null;
  if (backgroundColor && !isTransparentBackground(backgroundColor)) {
    effectiveBg = backgroundColor;
  } else if (background && !isTransparentBackground(background)) {
    effectiveBg = background;
  }

  // 清理根元素上的背景属性
  if (background) root.style.removeProperty("background");
  if (backgroundColor) root.style.removeProperty("background-color");

  if (root.style.length === 0 && root.hasAttribute("style")) {
    root.removeAttribute("style");
  }

  return effectiveBg;
};

/**
 * 检查元素是否位于一个拥有显式背景色的祖先元素内（root 以下）。
 * 如果是，则不应覆盖其背景色，因为祖先的背景色是主题有意为之。
 */
const hasAncestorWithExplicitBackground = (
  node: HTMLElement,
  root: HTMLElement,
): boolean => {
  let current = node.parentElement;
  while (current && current !== root) {
    const bg = current.style.getPropertyValue("background");
    const bgColor = current.style.getPropertyValue("background-color");
    const bgImage = current.style.getPropertyValue("background-image");
    if (
      (bg && !isTransparentBackground(bg)) ||
      (bgColor && !isTransparentBackground(bgColor)) ||
      hasExplicitBackgroundImage(bgImage)
    ) {
      return true;
    }
    current = current.parentElement;
  }
  return false;
};

const normalizeBlockBackgroundForWechat = (
  container: HTMLElement,
  rootBgColor: string | null,
): void => {
  const root = container.firstElementChild as HTMLElement | null;
  const blocks = container.querySelectorAll<HTMLElement>(
    "p,h1,h2,h3,h4,h5,h6,ul,ol,li,section,figure,figcaption",
  );

  blocks.forEach((node) => {
    const background = node.style.getPropertyValue("background");
    const backgroundColor = node.style.getPropertyValue("background-color");
    const backgroundImage = node.style.getPropertyValue("background-image");
    const hasExplicitBackground =
      (background && !isTransparentBackground(background)) ||
      (backgroundColor && !isTransparentBackground(backgroundColor)) ||
      hasExplicitBackgroundImage(backgroundImage);

    if (hasExplicitBackground) return;

    // 祖先元素（如 blockquote）已有显式背景色时，不覆盖子元素的背景
    if (root && hasAncestorWithExplicitBackground(node, root)) return;

    if (rootBgColor) {
      node.style.setProperty("background-color", rootBgColor, "important");
    } else {
      node.style.setProperty("background", "transparent", "important");
      node.style.setProperty("background-color", "transparent", "important");
    }
    node.style.setProperty("background-image", "none", "important");
  });
};

// ── 对外入口 ────────────────────────────────────────

export const normalizeCopyContainer = (container: HTMLElement): void => {
  transformWemdRootSectionToDiv(container);
  stripCopyMetadata(container);
  const rootBgColor = extractRootBackgroundColor(container);
  relocateRootPaddingToInnerWrapper(container);
  normalizeBlockBackgroundForWechat(container, rootBgColor);
  materializeTextColorForWechat(container);
};
