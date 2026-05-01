'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSettingsStore } from '@/lib/studio/store/settings';
import { defaultSettings } from '@/lib/studio/ai/mock-data';
import {
  ALL_PLATFORMS,
  PLATFORM_LABELS,
  PLATFORM_DESCRIPTIONS,
  PLATFORM_EMOJI,
} from '@/lib/studio/types';
import type { Platform, Settings } from '@/lib/studio/types';
import { Button } from '@/components/studio/ui/Button';
import { Dialog } from '@/components/studio/ui/Dialog';
import { toast } from '@/components/studio/ui/Toast';

function deepEqual<T>(a: T, b: T): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export default function SettingsPage() {
  const router = useRouter();
  const stored = useSettingsStore(s => s.settings);
  const setAll = useSettingsStore(s => s.setAll);

  const [active, setActive] = useState<Platform>('wechat');
  const [draft, setDraft] = useState<Settings>(stored);
  const [confirmReset, setConfirmReset] = useState<'one' | 'all' | null>(null);

  // store 同步过来时（首次 hydrate / 外部修改）刷新 draft
  useEffect(() => { setDraft(stored); }, [stored]);

  const dirty = useMemo(() => !deepEqual(draft, stored), [draft, stored]);
  const current = draft[active];

  function patchActive<K extends keyof typeof current>(key: K, value: typeof current[K]) {
    setDraft(prev => ({ ...prev, [active]: { ...prev[active], [key]: value } }));
  }

  function handleSave() {
    setAll(draft);
    toast('已保存');
  }

  function handleCancel() {
    setDraft(stored);
  }

  function handleReset(scope: 'one' | 'all') {
    if (scope === 'one') {
      setDraft(prev => ({ ...prev, [active]: defaultSettings[active] }));
    } else {
      setDraft(defaultSettings);
    }
    setConfirmReset(null);
    toast(scope === 'one' ? `已恢复「${PLATFORM_LABELS[active]}」默认` : '已全部恢复默认');
  }

  return (
    <div className="mx-auto max-w-6xl px-6 pt-6 pb-32">
      {/* 顶部标题区 */}
      <header className="flex items-start gap-4 pb-6 border-b border-[var(--color-border)]">
        <div className="h-12 w-12 rounded-xl bg-[var(--color-surface)] flex items-center justify-center text-xl">
          ⚙
        </div>
        <div className="flex-1 pt-1">
          <h1 className="font-serif text-2xl">平台设置</h1>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            为每个平台配置独立的系统提示词和生成参数
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push('/studio')}
          aria-label="关闭"
          className="h-9 w-9 inline-flex items-center justify-center rounded-md text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-fg)]"
        >
          ✕
        </button>
      </header>

      {/* 主内容：sidebar + 编辑区 */}
      <div className="grid grid-cols-[240px_1fr] gap-6 pt-6">
        {/* Sidebar */}
        <nav className="space-y-1.5">
          {ALL_PLATFORMS.map(p => (
            <button
              key={p}
              type="button"
              onClick={() => setActive(p)}
              className={
                'w-full text-left rounded-xl px-3 py-3 transition-all flex items-start gap-3 ' +
                (active === p
                  ? 'bg-[var(--color-surface)] ring-1 ring-[var(--color-accent)]/40 shadow-[0_0_0_3px_var(--color-accent-soft)]'
                  : 'hover:bg-[var(--color-surface)]')
              }
            >
              <span className="text-xl shrink-0 mt-0.5">{PLATFORM_EMOJI[p]}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{PLATFORM_LABELS[p]}</span>
                <span className="block text-xs text-[var(--color-muted)] mt-0.5 leading-relaxed line-clamp-2">
                  {PLATFORM_DESCRIPTIONS[p]}
                </span>
              </span>
            </button>
          ))}

          <div className="pt-4 mt-4 border-t border-[var(--color-border)]">
            <button
              type="button"
              onClick={() => setConfirmReset('all')}
              className="w-full text-left text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)] px-3 py-2 inline-flex items-center gap-2"
            >
              ↻ 全部恢复默认
            </button>
          </div>
        </nav>

        {/* 编辑区 */}
        <section className="space-y-8 min-w-0">
          <header className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <span className="text-2xl shrink-0">{PLATFORM_EMOJI[active]}</span>
              <div className="min-w-0">
                <h2 className="font-serif text-xl">{PLATFORM_LABELS[active]}</h2>
                <p className="text-xs text-[var(--color-muted)] mt-1">
                  {PLATFORM_DESCRIPTIONS[active]}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setConfirmReset('one')}>
              ↻ 恢复默认
            </Button>
          </header>

          {/* 标题模板 + 内容最大长度 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm flex items-center gap-2">
                <span className="font-mono text-[var(--color-muted)]">T</span>
                标题模板
              </label>
              <input
                value={current.titleTemplate}
                onChange={(e) => patchActive('titleTemplate', e.target.value)}
                className="w-full h-11 px-4 rounded-lg bg-[var(--color-surface)] text-sm outline-none
                           focus:ring-1 focus:ring-[var(--color-accent)]"
              />
              <p className="text-xs text-[var(--color-muted)]">
                使用 <code className="font-mono text-[var(--color-fg)]">{'{topic}'}</code> 作为主题占位符
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm flex items-center gap-2">
                <span className="font-mono text-[var(--color-muted)]">#</span>
                内容最大长度
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={100}
                  step={100}
                  value={current.maxLength}
                  onChange={(e) => patchActive('maxLength', Number(e.target.value) || 0)}
                  className="flex-1 h-11 px-4 rounded-lg bg-[var(--color-surface)] text-sm outline-none
                             font-mono focus:ring-1 focus:ring-[var(--color-accent)]"
                />
                <span className="text-sm text-[var(--color-muted)]">字符</span>
              </div>
              <p className="text-xs text-[var(--color-muted)]">限制生成内容的最大字符数</p>
            </div>
          </div>

          {/* 系统提示词 */}
          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <div>
                <label className="text-sm flex items-center gap-2">
                  <span>✨</span> 系统提示词
                </label>
                <p className="text-xs text-[var(--color-muted)] mt-1">
                  定义 AI 的角色、写作风格和格式要求，将在内容生成时作为系统指令发送
                </p>
              </div>
              <span className="text-xs font-mono text-[var(--color-muted)]">System Prompt</span>
            </div>
            <textarea
              value={current.systemPrompt}
              onChange={(e) => patchActive('systemPrompt', e.target.value)}
              rows={14}
              className="w-full bg-[var(--color-surface)] rounded-xl p-5 text-sm leading-7 outline-none resize-y
                         font-mono focus:ring-1 focus:ring-[var(--color-accent)]"
              placeholder="编写系统提示词…"
            />
          </div>
        </section>
      </div>

      {/* 底部固定操作栏 */}
      <footer className="fixed bottom-0 inset-x-0 z-30 border-t border-[var(--color-border)]
                         bg-[var(--color-bg)]/90 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
          <span className={'text-xs ' + (dirty ? 'text-[var(--color-accent)]' : 'text-[var(--color-muted)]')}>
            {dirty ? '● 有未保存的更改' : '所有更改已保存'}
          </span>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={handleCancel} disabled={!dirty}>
              取消
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!dirty}>
              💾 保存设置
            </Button>
          </div>
        </div>
      </footer>

      <Dialog
        open={confirmReset !== null}
        onClose={() => setConfirmReset(null)}
        title={confirmReset === 'all' ? '恢复全部平台默认？' : `恢复「${PLATFORM_LABELS[active]}」默认？`}
      >
        <p className="text-sm text-[var(--color-muted)] mb-5">
          {confirmReset === 'all'
            ? '会用内置默认提示词覆盖所有平台的当前内容。需要点击"保存设置"才会写入。'
            : '会用内置默认提示词覆盖该平台的当前内容。需要点击"保存设置"才会写入。'}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmReset(null)}>取消</Button>
          <Button variant="danger" onClick={() => handleReset(confirmReset!)}>
            恢复默认
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
