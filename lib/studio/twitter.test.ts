// lib/twitter.test.ts
import { describe, it, expect } from 'vitest';
import { singleToThread, threadToSingle } from './twitter';

describe('singleToThread', () => {
  it('短文本（< 280）返回单条推文', () => {
    const result = singleToThread('Hello world');
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('Hello world');
  });

  it('按双换行段落分割', () => {
    const input = '第一段内容\n\n第二段内容\n\n第三段内容';
    const result = singleToThread(input);
    expect(result.map(t => t.text)).toEqual(['第一段内容', '第二段内容', '第三段内容']);
  });

  it('段落超过 280 字时按句末标点切', () => {
    const long = 'A'.repeat(150) + '。' + 'B'.repeat(150) + '。' + 'C'.repeat(50);
    const result = singleToThread(long);
    expect(result.length).toBeGreaterThan(1);
    result.forEach(t => expect(t.text.length).toBeLessThanOrEqual(280));
  });

  it('单句仍超 280 时按 280 字硬切', () => {
    const result = singleToThread('X'.repeat(700));
    expect(result.length).toBe(3);
    expect(result[0].text).toHaveLength(280);
    expect(result[1].text).toHaveLength(280);
    expect(result[2].text).toHaveLength(140);
  });

  it('支持中英文标点 (。.!?！？)', () => {
    const input = 'A'.repeat(200) + '!' + 'B'.repeat(200);
    const result = singleToThread(input);
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe('A'.repeat(200) + '!');
    expect(result[1].text).toBe('B'.repeat(200));
  });

  it('空字符串返回空数组', () => {
    expect(singleToThread('')).toEqual([]);
    expect(singleToThread('   ')).toEqual([]);
  });

  it('每条 tweet 都有唯一 id', () => {
    const result = singleToThread('A\n\nB\n\nC');
    const ids = result.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('threadToSingle', () => {
  it('单条 thread 直接返回 text', () => {
    const result = threadToSingle([{ id: '1', text: 'Hello' }]);
    expect(result).toBe('Hello');
  });

  it('多条用 \\n\\n 拼接', () => {
    const tweets = [
      { id: '1', text: '第一条' },
      { id: '2', text: '第二条' },
      { id: '3', text: '第三条' },
    ];
    expect(threadToSingle(tweets)).toBe('第一条\n\n第二条\n\n第三条');
  });

  it('不强制截到 280', () => {
    const long = [{ id: '1', text: 'X'.repeat(500) }];
    expect(threadToSingle(long)).toHaveLength(500);
  });

  it('空数组返回空字符串', () => {
    expect(threadToSingle([])).toBe('');
  });
});
