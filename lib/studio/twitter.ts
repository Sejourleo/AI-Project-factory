import { nanoid } from 'nanoid';
import type { ThreadTweet } from './types';

const MAX_TWEET = 280;
const SENTENCE_END = /([。.!?！？])/;

function chunkBy280(text: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += MAX_TWEET) {
    out.push(text.slice(i, i + MAX_TWEET));
  }
  return out;
}

function splitParagraph(para: string): string[] {
  if (para.length <= MAX_TWEET) return [para];

  // 按句末标点切，保留标点在前一段尾部
  const parts = para.split(SENTENCE_END);
  const sentences: string[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    const body = parts[i] ?? '';
    const punct = parts[i + 1] ?? '';
    const merged = body + punct;
    if (merged) sentences.push(merged);
  }

  // 贪心合并相邻句子，单句仍超 280 则硬切
  const out: string[] = [];
  let buf = '';
  for (const s of sentences) {
    if (s.length > MAX_TWEET) {
      if (buf) { out.push(buf); buf = ''; }
      out.push(...chunkBy280(s));
      continue;
    }
    if (buf.length + s.length <= MAX_TWEET) {
      buf += s;
    } else {
      if (buf) out.push(buf);
      buf = s;
    }
  }
  if (buf) out.push(buf);
  return out;
}

export function singleToThread(input: string): ThreadTweet[] {
  const trimmed = input.trim();
  if (!trimmed) return [];

  const paragraphs = trimmed.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  const texts: string[] = [];
  for (const p of paragraphs) {
    texts.push(...splitParagraph(p));
  }

  return texts.map(text => ({ id: nanoid(8), text }));
}

export function threadToSingle(tweets: ThreadTweet[]): string {
  return tweets.map(t => t.text).join('\n\n');
}
