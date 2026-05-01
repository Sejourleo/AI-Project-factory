'use client';
import type { Chunk, PlatformSettings } from '../types';

interface OpenAIDelta {
  choices?: Array<{
    delta?: { content?: string };
    finish_reason?: string | null;
  }>;
}

export interface StreamWechatOptions {
  input: string;
  settings: PlatformSettings;
  signal?: AbortSignal;
}

/**
 * 调用 /api/studio/generate（Next.js route 转发到 SiliconFlow），把 OpenAI SSE delta
 * 转成内部 Chunk 协议。每次有新文本就 yield 一个 { kind: 'text', value }。
 */
export async function* streamWechatFromApi(opts: StreamWechatOptions): AsyncGenerator<Chunk> {
  const res = await fetch('/api/studio/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      platform: 'wechat',
      input: opts.input,
      settings: opts.settings,
    }),
    signal: opts.signal,
  });

  if (!res.ok || !res.body) {
    let detail = '';
    try {
      const j = await res.json();
      detail = (j as { error?: string }).error ?? '';
    } catch {
      detail = await res.text().catch(() => '');
    }
    throw new Error(`API ${res.status}: ${detail || 'unknown error'}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE：事件之间以空行分隔（\n\n）
      let sepIdx = buffer.indexOf('\n\n');
      while (sepIdx !== -1) {
        const event = buffer.slice(0, sepIdx);
        buffer = buffer.slice(sepIdx + 2);
        sepIdx = buffer.indexOf('\n\n');

        // 一个事件里可能有多行；只关心 data: 行
        for (const line of event.split('\n')) {
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            const json = JSON.parse(payload) as OpenAIDelta;
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) yield { kind: 'text', value: delta };
          } catch {
            // 忽略畸形 chunk
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
