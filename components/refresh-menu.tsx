'use client'

import { useState } from 'react'
import { Popover as PopoverPrimitive } from '@base-ui/react/popover'
import { Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { invalidateWechat } from '@/lib/data/wechat'
import { invalidateXhs } from '@/lib/data/xhs'
import { PLATFORMS, type KeywordConfig, type Platform } from '@/lib/types'
import { cn } from '@/lib/utils'

const REFRESHABLE_PLATFORMS: Platform[] = ['xiaohongshu', 'wechat']

type RefreshResult = { ok: true } | { ok: false; reason: string }

async function refreshOne(
  categoryId: string,
  keyword: string,
  platform: Platform
): Promise<RefreshResult> {
  try {
    if (platform === 'xiaohongshu') {
      const res = await fetch('/api/xhs/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId, keyword }),
      })
      const body = (await res.json().catch(() => ({}))) as {
        upstreamMessage?: string
        error?: string
      }
      if (!res.ok) return { ok: false, reason: body.upstreamMessage ?? body.error ?? `HTTP ${res.status}` }
      invalidateXhs(categoryId)
      return { ok: true }
    }
    if (platform === 'wechat') {
      const res = await fetch('/api/wechat/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId, keyword, period: 7 }),
      })
      const body = (await res.json().catch(() => ({}))) as {
        upstreamMessage?: string
        error?: string
      }
      if (!res.ok) return { ok: false, reason: body.upstreamMessage ?? body.error ?? `HTTP ${res.status}` }
      invalidateWechat(categoryId, keyword)
      return { ok: true }
    }
    return { ok: false, reason: '暂不支持该平台刷新' }
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : '网络错误' }
  }
}

export function RefreshMenu({
  categoryId,
  keywords,
  onRefreshed,
}: {
  categoryId: string
  keywords: KeywordConfig[] | undefined
  onRefreshed: () => void
}) {
  const [busy, setBusy] = useState<Set<string>>(new Set())

  const supported = (keywords ?? [])
    .map((k) => ({
      value: k.value,
      platforms: k.platforms.filter((p) => REFRESHABLE_PLATFORMS.includes(p)),
    }))
    .filter((k) => k.platforms.length > 0)

  const totalCells = supported.reduce((sum, k) => sum + k.platforms.length, 0)
  const allBusy = totalCells > 0 && busy.size >= totalCells

  async function refreshOneCell(keyword: string, platform: Platform) {
    const key = `${keyword}:${platform}`
    setBusy((s) => new Set(s).add(key))
    const result = await refreshOne(categoryId, keyword, platform)
    setBusy((s) => {
      const next = new Set(s)
      next.delete(key)
      return next
    })
    const platformName = PLATFORMS.find((p) => p.id === platform)?.name ?? platform
    if (result.ok) {
      toast.success(`已更新 ${keyword} · ${platformName}`)
      onRefreshed()
    } else {
      toast.error(`${keyword} · ${platformName}：${result.reason}`)
    }
  }

  async function refreshAll() {
    if (totalCells === 0) return
    const allKeys = supported.flatMap((k) => k.platforms.map((p) => `${k.value}:${p}`))
    setBusy(new Set(allKeys))
    const results = await Promise.all(
      supported.flatMap((k) =>
        k.platforms.map((p) => refreshOne(categoryId, k.value, p))
      )
    )
    setBusy(new Set())
    const failed = results.filter((r) => !r.ok)
    if (failed.length === 0) {
      toast.success(`全部更新完成（${results.length} 项）`)
    } else {
      const firstReason = (failed[0] as { ok: false; reason: string }).reason
      toast.error(
        `${results.length - failed.length} 成功 / ${failed.length} 失败：${firstReason}`
      )
    }
    onRefreshed()
  }

  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger
        render={
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-neutral-200 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors">
            <RefreshCw size={13} />
            更新数据
          </button>
        }
      />
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner sideOffset={6} align="end">
          <PopoverPrimitive.Popup className="bg-white rounded-xl shadow-lg ring-1 ring-black/5 p-3 min-w-[340px] max-w-[440px] max-h-[60vh] overflow-y-auto outline-none">
            <div className="flex items-center justify-between mb-3 gap-3">
              <div>
                <div className="text-sm font-medium text-neutral-900">更新数据</div>
                <div className="text-[11px] text-neutral-400 mt-0.5">
                  点击平台按钮单独更新，或一键全部更新
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={refreshAll}
                disabled={totalCells === 0 || allBusy}
              >
                {allBusy ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <RefreshCw size={12} />
                )}
                全部更新
              </Button>
            </div>
            {supported.length === 0 ? (
              <p className="text-xs text-neutral-400 py-6 text-center">
                暂无启用支持采集平台（小红书 / 公众号）的关键词
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {supported.map((k) => (
                  <div
                    key={k.value}
                    className="flex items-center gap-2 px-2 py-2 rounded-lg bg-neutral-50"
                  >
                    <span className="text-xs text-neutral-900 flex-1 truncate min-w-[6rem]">
                      {k.value}
                    </span>
                    <div className="flex gap-1 shrink-0">
                      {k.platforms.map((pid) => {
                        const p = PLATFORMS.find((x) => x.id === pid)!
                        const key = `${k.value}:${pid}`
                        const busyCell = busy.has(key)
                        return (
                          <button
                            key={pid}
                            onClick={() => refreshOneCell(k.value, pid)}
                            disabled={busyCell}
                            className={cn(
                              'inline-flex items-center gap-1 px-2 h-6 rounded-md text-[11px] text-white transition-opacity disabled:opacity-60',
                              busyCell && 'cursor-wait'
                            )}
                            style={{ backgroundColor: p.color }}
                            aria-label={`更新 ${k.value} 的${p.name}数据`}
                          >
                            <span>{p.icon}</span>
                            <span>{p.name}</span>
                            {busyCell ? (
                              <Loader2 size={10} className="animate-spin" />
                            ) : (
                              <RefreshCw size={10} />
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
