'use client'

import { useState } from 'react'
import { Clock, Pause, Pencil, Play, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AccountDialog } from '@/components/account-dialog'
import { useCategories } from '@/components/categories-provider'
import { PLATFORMS, type MonitorSettings, type Platform } from '@/lib/types'
import { cn } from '@/lib/utils'

const ALL_PLATFORMS: Platform[] = PLATFORMS.map((p) => p.id)

export function SettingsForm({ categoryId }: { categoryId: string }) {
  const { getById, updateSettings } = useCategories()
  const cat = getById(categoryId)
  const [settings, setSettings] = useState<MonitorSettings>(
    cat?.settings ?? { keywords: [], accounts: [] }
  )
  const [keywordInput, setKeywordInput] = useState('')
  const [pausedAccounts, setPausedAccounts] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  if (!cat) {
    return (
      <div className="p-8">
        <div className="bg-white rounded-2xl p-10 shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] text-sm text-neutral-400">
          分类不存在
        </div>
      </div>
    )
  }

  const dirty = JSON.stringify(settings) !== JSON.stringify(cat.settings)

  function addKeyword() {
    const v = keywordInput.trim()
    if (!v || settings.keywords.some((k) => k.value === v)) return
    setSettings((s) => ({
      ...s,
      keywords: [...s.keywords, { value: v, platforms: [...ALL_PLATFORMS] }],
    }))
    setKeywordInput('')
  }

  function removeKeyword(value: string) {
    setSettings((s) => ({ ...s, keywords: s.keywords.filter((k) => k.value !== value) }))
  }

  function togglePlatform(value: string, platform: Platform) {
    setSettings((s) => ({
      ...s,
      keywords: s.keywords.map((k) =>
        k.value === value
          ? {
              ...k,
              platforms: k.platforms.includes(platform)
                ? k.platforms.filter((p) => p !== platform)
                : [...k.platforms, platform],
            }
          : k
      ),
    }))
  }

  function addAccount(a: { platform: Platform; handle: string; displayName: string }) {
    setSettings((s) => ({ ...s, accounts: [...s.accounts, a] }))
  }

  function updateAccount(
    oldHandle: string,
    oldPlatform: Platform,
    next: { platform: Platform; handle: string; displayName: string }
  ) {
    setSettings((s) => ({
      ...s,
      accounts: s.accounts.map((a) =>
        a.handle === oldHandle && a.platform === oldPlatform ? next : a
      ),
    }))
  }

  function removeAccount(handle: string, platform: Platform) {
    setSettings((s) => ({
      ...s,
      accounts: s.accounts.filter((a) => !(a.handle === handle && a.platform === platform)),
    }))
  }

  function togglePause(handle: string, platform: Platform) {
    const key = `${platform}-${handle}`
    setPausedAccounts((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function save() {
    if (settings.keywords.length === 0) {
      toast.error('至少添加一个关键词')
      return
    }
    if (settings.keywords.some((k) => k.platforms.length === 0)) {
      toast.error('每个关键词至少启用一个平台')
      return
    }
    setSaving(true)
    try {
      await updateSettings(categoryId, settings)
      toast.success('设置已保存')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-8 max-w-3xl flex flex-col gap-6">
      <div className="bg-white rounded-2xl p-4 shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] flex items-start gap-3">
        <Clock size={14} className="shrink-0 mt-0.5 text-neutral-400" />
        <div className="text-xs text-neutral-600 leading-relaxed">
          该分类将于每天 08:00 自动运行采集任务。当前为原型演示，不会真实采集。
        </div>
      </div>

      <section className="bg-white rounded-2xl p-6 shadow-[0_1px_3px_0_rgba(0,0,0,0.04)]">
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <h3 className="text-sm font-medium text-neutral-500">对标关键词</h3>
            <p className="text-[11px] text-neutral-400 mt-0.5">每个关键词可独立选择监控平台</p>
          </div>
          <span className="text-[11px] text-neutral-400">共 {settings.keywords.length} 个</span>
        </div>
        <div className="flex gap-2 mb-4">
          <Input
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addKeyword()
              }
            }}
            placeholder="输入关键词按回车添加"
          />
          <Button variant="outline" onClick={addKeyword} disabled={!keywordInput.trim()}>
            添加
          </Button>
        </div>
        {settings.keywords.length === 0 ? (
          <p className="text-xs text-neutral-400">暂无关键词</p>
        ) : (
          <div className="flex flex-col gap-2">
            {settings.keywords.map((k) => (
              <div
                key={k.value}
                className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-neutral-50"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="text-sm text-neutral-900 truncate min-w-[5rem] max-w-[10rem]">
                    {k.value}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {PLATFORMS.map((p) => {
                      const enabled = k.platforms.includes(p.id)
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => togglePlatform(k.value, p.id)}
                          className={cn(
                            'inline-flex items-center gap-1 px-2 h-6 rounded-md text-[11px] transition-colors border',
                            enabled
                              ? 'text-white border-transparent'
                              : 'bg-white border-neutral-200 text-neutral-400 hover:text-neutral-700'
                          )}
                          style={
                            enabled
                              ? { backgroundColor: p.color }
                              : undefined
                          }
                          aria-pressed={enabled}
                          aria-label={`${p.name} ${enabled ? '已启用' : '未启用'}`}
                        >
                          <span>{p.icon}</span>
                          <span>{p.name}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
                <button
                  onClick={() => removeKeyword(k.value)}
                  className="size-7 flex items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-200/70 hover:text-neutral-900 transition-colors shrink-0"
                  aria-label={`移除 ${k.value}`}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-white rounded-2xl p-6 shadow-[0_1px_3px_0_rgba(0,0,0,0.04)]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-neutral-500">对标博主 / 账号</h3>
          <AccountDialog onSubmit={addAccount} />
        </div>
        {settings.accounts.length === 0 ? (
          <div className="text-xs text-neutral-400 py-8 text-center">暂无对标博主</div>
        ) : (
          <div className="space-y-1.5">
            {settings.accounts.map((a) => {
              const platform = PLATFORMS.find((p) => p.id === a.platform)!
              const key = `${a.platform}-${a.handle}`
              const paused = pausedAccounts.has(key)
              return (
                <div
                  key={key}
                  className={cn(
                    'flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-neutral-50',
                    paused && 'opacity-50'
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="size-2 rounded-full shrink-0"
                      style={{ backgroundColor: platform.color }}
                    />
                    <div className="min-w-0">
                      <div className="text-sm text-neutral-900 truncate">{a.displayName}</div>
                      <div className="text-[11px] text-neutral-400 truncate">
                        {platform.name} · @{a.handle}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={() => togglePause(a.handle, a.platform)}
                      className="size-7 flex items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-200/70 hover:text-neutral-900 transition-colors"
                      aria-label={paused ? '恢复' : '暂停'}
                    >
                      {paused ? <Play size={13} /> : <Pause size={13} />}
                    </button>
                    <AccountDialog
                      initial={a}
                      onSubmit={(next) => updateAccount(a.handle, a.platform, next)}
                      trigger={
                        <button
                          className="size-7 flex items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-200/70 hover:text-neutral-900 transition-colors"
                          aria-label="编辑"
                        >
                          <Pencil size={13} />
                        </button>
                      }
                    />
                    <button
                      onClick={() => removeAccount(a.handle, a.platform)}
                      className="size-7 flex items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-200/70 hover:text-neutral-900 transition-colors"
                      aria-label="删除"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <div className="sticky bottom-0 -mx-8 px-8 py-4 bg-neutral-50/80 backdrop-blur flex justify-end gap-2 border-t border-neutral-200/60">
        <Button
          variant="ghost"
          onClick={() => setSettings(cat.settings)}
          disabled={!dirty || saving}
        >
          重置
        </Button>
        <Button onClick={save} disabled={!dirty || saving}>
          {saving ? '保存中…' : '保存设置'}
        </Button>
      </div>
    </div>
  )
}
