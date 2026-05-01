// lib/ai/generate.test.ts
import { describe, it, expect } from 'vitest';
import { generateContent } from './generate';
import { defaultSettings } from './mock-data';

const baseOpts = {
  input: '如何专注',
  settings: defaultSettings.wechat,
  chunkDelayMs: 0,
};

describe('generateContent', () => {
  it('wechat 平台只 yield text chunks，最后拼起来等于完整 HTML', async () => {
    const chunks: string[] = [];
    for await (const c of generateContent({ ...baseOpts, platform: 'wechat' })) {
      expect(c.kind).toBe('text');
      if (c.kind === 'text') chunks.push(c.value);
    }
    const joined = chunks.join('');
    expect(joined).toContain('<h2>引言</h2>');
    expect(joined).toContain('如何专注');
  });

  it('xhs 平台先 yield init，再按字段顺序 yield field chunks', async () => {
    const events: string[] = [];
    for await (const c of generateContent({
      ...baseOpts,
      platform: 'xhs',
      settings: defaultSettings.xhs,
    })) {
      events.push(c.kind);
    }
    expect(events[0]).toBe('init');
    expect(events.slice(1).every(e => e === 'field')).toBe(true);
  });

  it('xhs 字段聚合后能复原完整内容', async () => {
    const fields: Record<string, string> = {};
    for await (const c of generateContent({
      ...baseOpts,
      platform: 'xhs',
      settings: defaultSettings.xhs,
    })) {
      if (c.kind === 'field') {
        fields[c.field] = (fields[c.field] ?? '') + c.value;
      }
    }
    expect(fields.title).toContain('如何专注');
    expect(fields.body.length).toBeGreaterThan(50);
  });

  it('twitter auto + 长输入 → mode=thread', async () => {
    const events: Array<{ kind: string; mode?: string }> = [];
    for await (const c of generateContent({
      ...baseOpts,
      input: '如何在多任务环境中保持深度专注的实用方法论',
      platform: 'twitter',
      settings: defaultSettings.twitter,
      hints: { twitterMode: 'auto' },
    })) {
      events.push(c);
    }
    const init = events[0];
    expect(init.kind).toBe('init');
    expect(init.mode).toBe('thread');
  });

  it('twitter auto + 短输入 → mode=single', async () => {
    const events: Array<{ kind: string; mode?: string }> = [];
    for await (const c of generateContent({
      ...baseOpts,
      input: '加油',
      platform: 'twitter',
      settings: defaultSettings.twitter,
      hints: { twitterMode: 'auto' },
    })) {
      events.push(c);
    }
    expect(events[0].mode).toBe('single');
  });

  it('twitter 显式 single 时无视输入长度', async () => {
    const events: Array<{ kind: string; mode?: string }> = [];
    for await (const c of generateContent({
      ...baseOpts,
      input: '一段非常非常长的输入提示词描述了大量复杂场景',
      platform: 'twitter',
      settings: defaultSettings.twitter,
      hints: { twitterMode: 'single' },
    })) {
      events.push(c);
    }
    expect(events[0].mode).toBe('single');
  });

  it('AbortSignal 触发后立即停止', async () => {
    const ctrl = new AbortController();
    const gen = generateContent({
      ...baseOpts,
      platform: 'wechat',
      chunkDelayMs: 5,
      signal: ctrl.signal,
    });
    let count = 0;
    setTimeout(() => ctrl.abort(), 15);
    for await (const _ of gen) {
      count++;
      if (count > 200) break;  // safety
    }
    expect(count).toBeLessThan(200);
  });
});
