'use client';
import { nanoid } from 'nanoid';
import { useSessionsStore } from '@/lib/studio/store/sessions';
import type { Scene } from '@/lib/studio/types';

interface Props {
  sessionId: string;
}

export function VideoEditor({ sessionId }: Props) {
  const scenes = useSessionsStore(s => s.sessions[sessionId]?.content.video);
  const setContent = useSessionsStore(s => s.setContent);

  if (!scenes) return <div className="text-sm text-[var(--color-muted)]">等待生成…</div>;

  function patchScene(idx: number, p: Partial<Scene>) {
    const next = scenes!.map((s, i) => i === idx ? { ...s, ...p } : s);
    setContent(sessionId, 'video', next);
  }

  function removeScene(idx: number) {
    const next = scenes!.filter((_, i) => i !== idx).map((s, i) => ({ ...s, index: i + 1 }));
    setContent(sessionId, 'video', next);
  }

  function addScene() {
    const newIndex = scenes!.length + 1;
    setContent(sessionId, 'video', [
      ...scenes!,
      { id: nanoid(8), index: newIndex, time: '00:00-00:00', shot: '', voice: '' },
    ]);
  }

  return (
    <div className="space-y-4">
      {scenes.map((s, i) => (
        <div key={s.id} className="rounded-2xl bg-[var(--color-surface)] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm">分镜 #{s.index}</span>
              <input
                value={s.time}
                onChange={(e) => patchScene(i, { time: e.target.value })}
                placeholder="00:00-00:00"
                className="w-28 bg-[var(--color-elevated)] rounded px-2 py-1 text-xs font-mono outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => removeScene(i)}
              className="text-[var(--color-muted)] hover:text-[var(--color-fg)] text-sm"
            >×</button>
          </div>
          <div className="space-y-2">
            <div className="text-xs text-[var(--color-muted)]">画面描述</div>
            <textarea
              value={s.shot}
              onChange={(e) => patchScene(i, { shot: e.target.value })}
              rows={2}
              className="w-full bg-[var(--color-elevated)] rounded-lg p-3 text-sm leading-6 outline-none resize-none"
            />
          </div>
          <div className="space-y-2">
            <div className="text-xs text-[var(--color-muted)]">旁白口播</div>
            <textarea
              value={s.voice}
              onChange={(e) => patchScene(i, { voice: e.target.value })}
              rows={2}
              className="w-full bg-[var(--color-elevated)] rounded-lg p-3 text-sm leading-6 outline-none resize-none"
            />
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={addScene}
        className="w-full h-12 rounded-2xl bg-[var(--color-surface)] text-sm text-[var(--color-muted)]
                   hover:text-[var(--color-fg)] hover:bg-[var(--color-elevated)] transition-colors"
      >
        + 添加分镜
      </button>
    </div>
  );
}
