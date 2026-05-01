'use client';
import { nanoid } from 'nanoid';
import { useSessionsStore } from '@/lib/studio/store/sessions';
import type { TwitterContent, TwitterMode } from '@/lib/studio/types';

interface Props {
  sessionId: string;
}

const MAX = 280;

function CharCount({ n }: { n: number }) {
  const over = n > MAX;
  return (
    <span className={'font-mono text-xs ' + (over ? 'text-[var(--color-fg)]' : 'text-[var(--color-muted)]')}>
      {n}/{MAX}
    </span>
  );
}

export function TwitterEditor({ sessionId }: Props) {
  const tw = useSessionsStore(s => s.sessions[sessionId]?.content.twitter);
  const setContent = useSessionsStore(s => s.setContent);
  const setMode = useSessionsStore(s => s.setTwitterMode);

  if (!tw) return <div className="text-sm text-[var(--color-muted)]">等待生成…</div>;

  function patch(p: Partial<TwitterContent>) {
    setContent(sessionId, 'twitter', { ...tw!, ...p });
  }

  function changeTweet(idx: number, text: string) {
    const next = tw!.thread.map((t, i) => i === idx ? { ...t, text } : t);
    patch({ thread: next });
  }

  function addTweet() {
    patch({ thread: [...tw!.thread, { id: nanoid(8), text: '' }] });
  }

  function removeTweet(idx: number) {
    patch({ thread: tw!.thread.filter((_, i) => i !== idx) });
  }

  function ModeBtn({ value, label }: { value: TwitterMode; label: string }) {
    return (
      <button
        type="button"
        onClick={() => setMode(sessionId, value)}
        className={
          'h-8 px-4 text-sm transition-colors ' +
          (tw!.mode === value
            ? 'bg-[var(--color-elevated)] text-[var(--color-fg)]'
            : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]')
        }
      >
        {label}
      </button>
    );
  }

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg bg-[var(--color-surface)] p-1">
        <ModeBtn value="single" label="单条" />
        <ModeBtn value="thread" label="Thread" />
      </div>

      {tw.mode === 'single' ? (
        <div className="rounded-2xl bg-[var(--color-surface)] p-5 space-y-3">
          <textarea
            value={tw.single}
            onChange={(e) => patch({ single: e.target.value })}
            placeholder="写点什么…"
            rows={6}
            className="w-full bg-transparent leading-7 outline-none resize-none text-base"
          />
          <div className="flex justify-end">
            <CharCount n={tw.single.length} />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {tw.thread.map((t, i) => (
            <div key={t.id} className="rounded-2xl bg-[var(--color-surface)] p-5 relative">
              <div className="flex items-start gap-3">
                <span className="font-mono text-xs text-[var(--color-muted)] mt-1 shrink-0">{i + 1}</span>
                <textarea
                  value={t.text}
                  onChange={(e) => changeTweet(i, e.target.value)}
                  rows={3}
                  className="flex-1 bg-transparent leading-7 outline-none resize-none"
                />
                <button
                  type="button"
                  onClick={() => removeTweet(i)}
                  className="text-[var(--color-muted)] hover:text-[var(--color-fg)] text-sm"
                >×</button>
              </div>
              <div className="flex justify-end mt-2">
                <CharCount n={t.text.length} />
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addTweet}
            className="w-full h-12 rounded-2xl bg-[var(--color-surface)] text-sm text-[var(--color-muted)]
                       hover:text-[var(--color-fg)] hover:bg-[var(--color-elevated)] transition-colors"
          >
            + 添加推文
          </button>
        </div>
      )}
    </div>
  );
}
