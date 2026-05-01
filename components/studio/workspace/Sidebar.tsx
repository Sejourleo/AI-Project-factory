'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useSessionsStore } from '@/lib/studio/store/sessions';
import { Dialog } from '@/components/studio/ui/Dialog';
import { Button } from '@/components/studio/ui/Button';
import { InlineEdit } from '@/components/studio/ui/InlineEdit';
import type { Session } from '@/lib/studio/types';

interface Props {
  currentId: string;
}

function groupByMonth(sessions: Session[]): Map<string, Session[]> {
  const map = new Map<string, Session[]>();
  for (const s of sessions) {
    const d = new Date(s.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  return map;
}

export function Sidebar({ currentId }: Props) {
  const router = useRouter();
  const sessions = useSessionsStore(s => s.sessions);
  const order = useSessionsStore(s => s.order);
  const renameSession = useSessionsStore(s => s.renameSession);
  const deleteSession = useSessionsStore(s => s.deleteSession);

  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Session | null>(null);

  const list = order
    .map(id => sessions[id])
    .filter(Boolean)
    .filter(s => {
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      const haystack = [s.title ?? '', s.topic].join(' ').toLowerCase();
      return haystack.includes(q);
    });

  const groups = groupByMonth(list);

  function handleDelete() {
    if (!confirmDelete) return;
    const id = confirmDelete.id;
    deleteSession(id);
    setConfirmDelete(null);
    if (id === currentId) router.push('/studio');
  }

  return (
    <aside className="w-60 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-bg)]
                      flex flex-col h-[calc(100vh-3.5rem)] sticky top-14">
      <div className="p-3 space-y-2">
        <Link href="/studio" className="block">
          <Button variant="ghost" size="sm" className="w-full justify-start">+ 新建</Button>
        </Link>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索"
          className="w-full h-8 px-3 rounded-md bg-[var(--color-surface)] text-sm
                     placeholder:text-[var(--color-muted)] outline-none"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-4">
        {[...groups.entries()].map(([month, items]) => (
          <div key={month}>
            <div className="px-2 py-1 text-xs text-[var(--color-muted)] font-mono">{month}</div>
            <ul className="space-y-0.5">
              {items.map(s => (
                <li key={s.id} className="group relative">
                  {editingId === s.id ? (
                    <div className="px-2 py-1.5">
                      <InlineEdit
                        value={s.title ?? s.topic}
                        onCommit={(next) => { renameSession(s.id, next); setEditingId(null); }}
                        onCancel={() => setEditingId(null)}
                      />
                    </div>
                  ) : (
                    <Link
                      href={`/studio/workspace/${s.id}`}
                      className={
                        'block px-2 py-1.5 rounded-md text-sm truncate transition-colors ' +
                        (s.id === currentId
                          ? 'bg-[var(--color-surface)] text-[var(--color-fg)]'
                          : 'text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)]')
                      }
                    >
                      {s.title ?? s.topic.slice(0, 28)}
                    </Link>
                  )}
                  <div className="hidden group-hover:flex absolute right-1 top-1 gap-1">
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); setEditingId(s.id); }}
                      className="text-xs px-1.5 py-0.5 text-[var(--color-muted)] hover:text-[var(--color-fg)]"
                    >
                      重命名
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); setConfirmDelete(s); }}
                      className="text-xs px-1.5 py-0.5 text-[var(--color-muted)] hover:text-[#e85a5a]"
                    >
                      删除
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {list.length === 0 && (
          <div className="px-3 py-6 text-xs text-[var(--color-muted)]">还没有会话</div>
        )}
      </div>

      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="删除会话">
        <p className="text-sm text-[var(--color-muted)] mb-5">
          确定删除「{confirmDelete?.title ?? confirmDelete?.topic.slice(0, 30)}」吗？此操作不可撤销。
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmDelete(null)}>取消</Button>
          <Button variant="danger" onClick={handleDelete}>删除</Button>
        </div>
      </Dialog>
    </aside>
  );
}
