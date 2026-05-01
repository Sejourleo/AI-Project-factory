// lib/ai/generate.ts
import type { Platform, PlatformSettings, TwitterModeHint, Chunk, XhsContent, Scene, TwitterContent } from '../types';
import {
  mockWechatHtml,
  mockXhsContent,
  mockTwitterContent,
  mockVideoScenes,
} from './mock-data';

export interface GenerateOptions {
  input: string;
  platform: Platform;
  settings: PlatformSettings;
  hints?: { twitterMode?: TwitterModeHint };
  signal?: AbortSignal;
  chunkDelayMs?: number;
}

const DEFAULT_DELAY = 40;
const CHUNK_MIN = 8;
const CHUNK_MAX = 15;

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    if (signal) {
      const onAbort = () => {
        clearTimeout(timer);
        reject(new DOMException('aborted', 'AbortError'));
      };
      if (signal.aborted) onAbort();
      else signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

function* chunkString(text: string): Generator<string> {
  let i = 0;
  while (i < text.length) {
    const len = CHUNK_MIN + Math.floor(Math.random() * (CHUNK_MAX - CHUNK_MIN + 1));
    yield text.slice(i, i + len);
    i += len;
  }
}

async function* streamText(text: string, delayMs: number, signal?: AbortSignal): AsyncGenerator<Chunk> {
  for (const piece of chunkString(text)) {
    if (signal?.aborted) return;
    try {
      await sleep(delayMs, signal);
    } catch {
      return;
    }
    yield { kind: 'text', value: piece };
  }
}

async function* streamFields(
  fields: Array<[string, string]>,
  delayMs: number,
  signal?: AbortSignal,
): AsyncGenerator<Chunk> {
  for (const [field, value] of fields) {
    for (const piece of chunkString(value)) {
      if (signal?.aborted) return;
      try {
        await sleep(delayMs, signal);
      } catch {
        return;
      }
      yield { kind: 'field', field, value: piece };
    }
  }
}

function decideTwitterMode(hint: TwitterModeHint | undefined, input: string): 'single' | 'thread' {
  if (hint === 'single' || hint === 'thread') return hint;
  return input.length > 10 ? 'thread' : 'single';
}

export async function* generateContent(opts: GenerateOptions): AsyncGenerator<Chunk> {
  const delay = opts.chunkDelayMs ?? DEFAULT_DELAY;
  const { platform, signal, input } = opts;

  if (platform === 'wechat') {
    yield* streamText(mockWechatHtml(input), delay, signal);
    return;
  }

  if (platform === 'xhs') {
    const data = mockXhsContent(input);
    const skeleton: XhsContent = { title: '', body: '', tags: [], images: data.images };
    yield { kind: 'init', skeleton };
    yield* streamFields(
      [['title', data.title], ['body', data.body]],
      delay,
      signal,
    );
    if (signal?.aborted) return;
    // tags 整体一次性发送，避免被分片成多个 chunk 后 store 端 split 错乱
    yield { kind: 'field', field: 'tags', value: data.tags.join(',') };
    return;
  }

  if (platform === 'twitter') {
    const mode = decideTwitterMode(opts.hints?.twitterMode, input);
    const data = mockTwitterContent(input, mode);
    const skeleton: TwitterContent =
      mode === 'single'
        ? { mode, single: '', thread: [] }
        : { mode, single: '', thread: data.thread.map(t => ({ id: t.id, text: '' })) };
    yield { kind: 'init', skeleton, mode };

    if (mode === 'single') {
      yield* streamFields([['single', data.single]], delay, signal);
    } else {
      // 按 tweet id 作为 field name，让 store 端按 id append 到对应位置
      const pairs: Array<[string, string]> = data.thread.map(t => [`thread:${t.id}`, t.text]);
      yield* streamFields(pairs, delay, signal);
    }
    return;
  }

  if (platform === 'video') {
    const scenes = mockVideoScenes(input);
    const skeleton: Scene[] = scenes.map(s => ({
      id: s.id,
      index: s.index,
      time: s.time,
      shot: '',
      voice: '',
    }));
    yield { kind: 'init', skeleton };
    const pairs: Array<[string, string]> = [];
    for (const s of scenes) {
      pairs.push([`scene:${s.id}:shot`, s.shot]);
      pairs.push([`scene:${s.id}:voice`, s.voice]);
    }
    yield* streamFields(pairs, delay, signal);
    return;
  }
}
