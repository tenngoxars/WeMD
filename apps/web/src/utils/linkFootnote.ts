/**
 * 将外部链接转换为脚注引用
 * 微信内部链接（mp.weixin.qq.com）不转换
 */
export function convertLinksToFootnotes(html: string): string {
  const links: { text: string; url: string }[] = [];
  let counter = 1;

  // 匹配 <a href="url">text</a>，提取 href 和文本内容
  const result = html.replace(
    /<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
    (match, url, text) => {
      // 跳过微信内部链接
      if (url.includes("mp.weixin.qq.com")) return match;
      // 跳过锚点链接
      if (url.startsWith("#")) return match;
      // 跳过空链接
      if (!url || url === "url") return text;

      const cleanedText = text.trim() || url;
      links.push({ text: cleanedText, url });
      return `<span class="footnote-word">${cleanedText}</span><sup class="footnote-ref">[${counter++}]</sup>`;
    },
  );

  // 如果有外链，在末尾添加脚注列表
  if (links.length > 0) {
    const footnoteItems = links
      .map(
        (l, i) =>
          `<div class="footnote-item"><span class="footnote-num">[${i + 1}] </span><p>${l.text}<br/>${l.url}</p></div>`,
      )
      .join("");
    return `${result}<h3 class="footnotes-sep"></h3>\n<section class="footnotes">\n${footnoteItems}\n</section>`;
  }

  return result;
}
