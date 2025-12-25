// 外链转脚注开关状态（全局，供复制服务使用）
export const LINK_TO_FOOTNOTE_EVENT = "wemd-link-to-footnote-change";
let linkToFootnoteEnabled = false;

export function getLinkToFootnoteEnabled() {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("wemd-link-to-footnote");
    if (saved === "true" || saved === "false") {
      linkToFootnoteEnabled = saved === "true";
    }
  }
  return linkToFootnoteEnabled;
}

export function setLinkToFootnoteEnabled(enabled: boolean) {
  linkToFootnoteEnabled = enabled;
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<boolean>(LINK_TO_FOOTNOTE_EVENT, { detail: enabled }),
    );
  }
}
