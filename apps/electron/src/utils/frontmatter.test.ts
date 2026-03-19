import test from 'node:test';
import assert from 'node:assert/strict';
import { extractFrontmatterMeta } from './frontmatter';

test('支持 CRLF 与 BOM 的 frontmatter 解析', () => {
    const content = "\uFEFF---\r\ntitle: 标题\r\nthemeName: \"森林绿\"\r\n---\r\n\r\n正文";
    const parsed = extractFrontmatterMeta(content);
    assert.equal(parsed.themeName, '森林绿');
    assert.equal(parsed.title, '标题');
});

test('无 frontmatter 时返回默认主题', () => {
    const parsed = extractFrontmatterMeta('正文内容');
    assert.equal(parsed.themeName, '默认主题');
    assert.equal(parsed.title, undefined);
});
