'use client';
import { useSessionsStore } from './store/sessions';
import { useSettingsStore } from './store/settings';
import { generateContent } from './ai/generate';
import { streamWechatFromApi } from './ai/streamWechat';
import type { Chunk, Platform, TwitterModeHint } from './types';

export interface RunOptions {
  input: string;
  platforms: Platform[];
  twitterHint: TwitterModeHint;
}

export async function startGeneration(opts: RunOptions): Promise<string> {
  const session = useSessionsStore.getState().createSession(opts.input, opts.platforms);

  // fire-and-forget per platform
  opts.platforms.forEach(p => streamOne(session.id, p, opts));

  return session.id;
}

async function streamOne(sessionId: string, platform: Platform, opts: RunOptions) {
  const { setStatus, applyChunk } = useSessionsStore.getState();
  const settings = useSettingsStore.getState().settings[platform];

  setStatus(sessionId, platform, 'streaming');
  try {
    const stream: AsyncGenerator<Chunk> =
      platform === 'wechat'
        ? streamWechatFromApi({ input: opts.input, settings })
        : generateContent({
            input: opts.input,
            platform,
            settings,
            hints: { twitterMode: opts.twitterHint },
          });
    for await (const chunk of stream) {
      applyChunk(sessionId, platform, chunk);
    }
    setStatus(sessionId, platform, 'done');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    setStatus(sessionId, platform, 'error', msg);
  }
}
