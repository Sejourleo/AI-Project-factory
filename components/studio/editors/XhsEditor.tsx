'use client';
import { useSessionsStore } from '@/lib/studio/store/sessions';
import type { XhsContent } from '@/lib/studio/types';

interface Props {
  sessionId: string;
}

export function XhsEditor({ sessionId }: Props) {
  const xhs = useSessionsStore(s => s.sessions[sessionId]?.content.xhs);
  const setContent = useSessionsStore(s => s.setContent);

  if (!xhs) {
    return <div className="text-sm text-[var(--color-muted)]">等待生成…</div>;
  }

  function patch(p: Partial<XhsContent>) {
    setContent(sessionId, 'xhs', { ...xhs!, ...p });
  }

  function setTag(idx: number, value: string) {
    const next = [...xhs!.tags];
    next[idx] = value;
    patch({ tags: next });
  }

  function removeTag(idx: number) {
    patch({ tags: xhs!.tags.filter((_, i) => i !== idx) });
  }

  function addTag() {
    patch({ tags: [...xhs!.tags, ''] });
  }

  const titleLen = xhs.title.length;
  const titleOver = titleLen > 20;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
      {/* 图片区 */}
      <div className="space-y-3">
        {xhs.images[0] && (
          <div className="aspect-[3/4] rounded-2xl bg-[var(--color-surface)] flex items-center justify-center p-6 text-center">
            <div>
              <div className="text-5xl mb-3">{xhs.images[0].emoji}</div>
              <div className="text-xs text-[var(--color-muted)] leading-relaxed">{xhs.images[0].desc}</div>
            </div>
          </div>
        )}
        {xhs.images.length > 1 && (
          <div className="grid grid-cols-3 gap-2">
            {xhs.images.slice(1, 9).map((img, i) => (
              <div key={i} className="aspect-square rounded-lg bg-[var(--color-surface)] flex items-center justify-center p-2 text-center">
                <div>
                  <div className="text-2xl">{img.emoji}</div>
                  <div className="text-[10px] text-[var(--color-muted)] mt-1 line-clamp-2">{img.desc}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 文案区 */}
      <div className="space-y-4">
        <div>
          <input
            value={xhs.title}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder="标题"
            className="w-full bg-transparent font-serif text-xl outline-none placeholder:text-[var(--color-muted)]"
          />
          <div className={'text-xs font-mono mt-1 ' + (titleOver ? 'text-[#e85a5a]' : 'text-[var(--color-muted)]')}>
            {titleLen}/20
          </div>
        </div>
        <textarea
          value={xhs.body}
          onChange={(e) => patch({ body: e.target.value })}
          placeholder="正文"
          rows={12}
          className="w-full bg-[var(--color-surface)] rounded-xl p-4 leading-7 outline-none resize-none"
        />
        <div className="space-y-2">
          <div className="text-xs text-[var(--color-muted)]">话题标签</div>
          <div className="flex flex-wrap gap-2">
            {xhs.tags.map((t, i) => (
              <span key={i} className="inline-flex items-center gap-1 bg-[var(--color-surface)] rounded-full pl-3 pr-1 py-1 text-sm">
                <span className="text-[var(--color-accent)] font-mono">#</span>
                <input
                  value={t}
                  onChange={(e) => setTag(i, e.target.value)}
                  className="bg-transparent outline-none w-24"
                />
                <button
                  type="button"
                  onClick={() => removeTag(i)}
                  className="h-5 w-5 inline-flex items-center justify-center rounded-full text-[var(--color-muted)] hover:text-[var(--color-fg)]"
                >×</button>
              </span>
            ))}
            <button
              type="button"
              onClick={addTag}
              className="text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)] px-2 py-1"
            >
              + 添加标签
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
