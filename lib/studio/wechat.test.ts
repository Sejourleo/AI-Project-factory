import { describe, it, expect } from 'vitest';
import {
  extractWechatTitle,
  countWechatImages,
  htmlToNewspicMarkdown,
} from './wechat';

describe('extractWechatTitle', () => {
  it('提取首个 h1 内的文本', () => {
    const html = '<h1>深度解析：专注</h1><h2>引言</h2><p>正文…</p>';
    expect(extractWechatTitle(html)).toBe('深度解析：专注');
  });

  it('h1 含粗体/斜体时提取纯文本', () => {
    expect(extractWechatTitle('<h1>关于<strong>专注</strong>的<em>思考</em></h1>')).toBe('关于专注的思考');
  });

  it('没 h1 时返回空字符串', () => {
    expect(extractWechatTitle('<p>没有标题</p>')).toBe('');
    expect(extractWechatTitle('')).toBe('');
  });

  it('超过 64 字符截断', () => {
    const long = 'x'.repeat(100);
    const result = extractWechatTitle(`<h1>${long}</h1>`);
    expect(result).toHaveLength(64);
  });

  it('只取首个 h1 不取后续', () => {
    expect(extractWechatTitle('<h1>第一</h1><h1>第二</h1>')).toBe('第一');
  });

  it('忽略前后空白', () => {
    expect(extractWechatTitle('<h1>  专注  </h1>')).toBe('专注');
  });
});

describe('countWechatImages', () => {
  it('统计带 src 的 img 数量', () => {
    const html = '<p>x</p><img src="https://a.com/1.jpg"><img src="https://a.com/2.jpg">';
    expect(countWechatImages(html)).toBe(2);
  });

  it('忽略空 src 占位图', () => {
    const html = '<img src=""><img src="https://a.com/1.jpg"><img src="">';
    expect(countWechatImages(html)).toBe(1);
  });

  it('支持单引号属性', () => {
    expect(countWechatImages(`<img src='https://a.com/1.jpg'>`)).toBe(1);
  });

  it('忽略只有空白的 src', () => {
    expect(countWechatImages('<img src="   ">')).toBe(0);
  });

  it('空 HTML 返回 0', () => {
    expect(countWechatImages('')).toBe(0);
  });
});

describe('htmlToNewspicMarkdown', () => {
  it('剥离 HTML 标签保留段落', () => {
    const html = '<h1>标题</h1><p>第一段</p><p>第二段</p>';
    const { content, imageCount } = htmlToNewspicMarkdown(html, 1000);
    expect(imageCount).toBe(0);
    expect(content).toContain('标题');
    expect(content).toContain('第一段');
    expect(content).toContain('第二段');
    expect(content).not.toContain('<');
  });

  it('img 转 markdown 语法', () => {
    const html = '<p>看图</p><img src="https://a.com/1.jpg" alt="说明"><p>结束</p>';
    const { content, imageCount } = htmlToNewspicMarkdown(html, 1000);
    expect(imageCount).toBe(1);
    expect(content).toContain('![说明](https://a.com/1.jpg)');
  });

  it('多张图都转出', () => {
    const html = '<img src="https://a.com/1.jpg" alt="一"><img src="https://a.com/2.jpg" alt="二">';
    const { imageCount } = htmlToNewspicMarkdown(html, 1000);
    expect(imageCount).toBe(2);
  });

  it('忽略空 src 的占位 img', () => {
    const html = '<img src=""><p>正文</p><img src="https://a.com/1.jpg">';
    const { imageCount } = htmlToNewspicMarkdown(html, 1000);
    expect(imageCount).toBe(1);
  });

  it('正文超过 maxChars 时截断（图片标记不计入截断长度）', () => {
    const long = 'x'.repeat(2000);
    const html = `<p>${long}</p><img src="https://a.com/1.jpg" alt="图">`;
    const { content, imageCount } = htmlToNewspicMarkdown(html, 1000);
    expect(imageCount).toBe(1);
    // 图片 markdown 应保留
    expect(content).toContain('![图](https://a.com/1.jpg)');
    // 文字部分不超过 1000
    const textOnly = content.replace(/!\[[^\]]*\]\([^)]+\)/g, '');
    expect(textOnly.length).toBeLessThanOrEqual(1000);
  });

  it('解码常见 HTML 实体', () => {
    const { content } = htmlToNewspicMarkdown('<p>A &amp; B &lt; C &gt; D &nbsp;E</p>', 1000);
    expect(content).toContain('A & B < C > D');
  });

  it('多个连续段落用空行分隔', () => {
    const { content } = htmlToNewspicMarkdown('<p>A</p><p>B</p>', 1000);
    expect(content).toMatch(/A\n\nB/);
  });
});
