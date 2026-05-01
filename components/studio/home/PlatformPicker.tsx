'use client';
import { ALL_PLATFORMS, PLATFORM_LABELS } from '@/lib/studio/types';
import type { Platform, TwitterModeHint } from '@/lib/studio/types';

interface Props {
  selected: Platform[];
  onToggle: (p: Platform) => void;
  twitterHint: TwitterModeHint;
  onTwitterHintChange: (h: TwitterModeHint) => void;
}

const PLATFORM_COLOR: Record<Platform, string> = {
  wechat: 'var(--color-platform-wechat)',
  xhs: 'var(--color-platform-xhs)',
  twitter: 'var(--color-platform-twitter)',
  video: 'var(--color-platform-video)',
};

const HINTS: { value: TwitterModeHint; label: string }[] = [
  { value: 'auto', label: 'AI 自动判定' },
  { value: 'single', label: '单条' },
  { value: 'thread', label: 'Thread' },
];

export function PlatformPicker({ selected, onToggle, twitterHint, onTwitterHintChange }: Props) {
  const has = (p: Platform) => selected.includes(p);

  return (
    <div className="space-y-4">
      <div className="text-sm text-[var(--color-muted)]">选择平台</div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {ALL_PLATFORMS.map(p => (
          <button
            key={p}
            type="button"
            onClick={() => onToggle(p)}
            className={
              'relative h-24 rounded-xl bg-[var(--color-surface)] text-left px-4 py-3 transition-all ' +
              (has(p)
                ? 'ring-1 ring-[var(--color-accent)] shadow-[0_0_0_4px_var(--color-accent-soft)]'
                : 'hover:bg-[var(--color-elevated)]')
            }
          >
            <div className="h-2 w-2 rounded-full mb-3" style={{ background: PLATFORM_COLOR[p] }} />
            <div className="text-sm font-medium">{PLATFORM_LABELS[p]}</div>
          </button>
        ))}
      </div>

      {has('twitter') && (
        <div className="rounded-xl bg-[var(--color-surface)] p-4 space-y-2">
          <div className="text-sm text-[var(--color-muted)]">Twitter 形式</div>
          <div className="flex gap-2">
            {HINTS.map(h => (
              <button
                key={h.value}
                type="button"
                onClick={() => onTwitterHintChange(h.value)}
                className={
                  'h-8 px-3 rounded-md text-sm transition-colors ' +
                  (twitterHint === h.value
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'text-[var(--color-muted)] hover:bg-[var(--color-elevated)]')
                }
              >
                {h.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
