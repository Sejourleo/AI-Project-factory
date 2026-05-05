'use client'

import { useEffect, useState, type ReactElement } from 'react'
import { UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PLATFORMS, type Platform } from '@/lib/types'
import { cn } from '@/lib/utils'

type Account = { platform: Platform; handle: string; displayName: string }

type AccountDialogProps = {
  /** 编辑模式时传入；否则进入新增模式 */
  initial?: Account
  onSubmit: (a: Account) => void
  /** 自定义触发按钮；不传则用默认「+ 新增博主」按钮（仅在新增模式下） */
  trigger?: ReactElement
}

const DEFAULT_ADD_TRIGGER = (
  <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-100 text-sm text-neutral-700 hover:bg-neutral-200/70 transition-colors">
    <UserPlus size={14} />
    新增博主
  </button>
)

export function AccountDialog({ initial, onSubmit, trigger }: AccountDialogProps) {
  const isEdit = initial !== undefined
  const [open, setOpen] = useState(false)
  const [platform, setPlatform] = useState<Platform>(initial?.platform ?? 'wechat')
  const [handle, setHandle] = useState(initial?.handle ?? '')
  const [displayName, setDisplayName] = useState(initial?.displayName ?? '')

  // 每次打开时同步 initial（编辑场景），关闭时也复位（新增场景）
  useEffect(() => {
    if (!open) return
    setPlatform(initial?.platform ?? 'wechat')
    setHandle(initial?.handle ?? '')
    setDisplayName(initial?.displayName ?? '')
  }, [open, initial])

  function submit() {
    if (!handle.trim() || !displayName.trim()) return
    onSubmit({ platform, handle: handle.trim(), displayName: displayName.trim() })
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger ?? DEFAULT_ADD_TRIGGER} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? '编辑对标博主' : '新增对标博主'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label>平台</Label>
            <div className="flex gap-1.5 flex-wrap">
              {PLATFORMS.map((p) => {
                const active = platform === p.id
                return (
                  <button
                    key={p.id}
                    onClick={() => setPlatform(p.id)}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full transition-colors',
                      active
                        ? 'bg-neutral-900 text-white'
                        : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200/70'
                    )}
                  >
                    <span
                      className="size-1.5 rounded-full"
                      style={{ backgroundColor: active ? '#ffffff' : p.color }}
                    />
                    {p.name}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="handle">账号 ID / Handle</Label>
            <Input
              id="handle"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="如 ai_daily"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dn">显示名称</Label>
            <Input
              id="dn"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="如 AI 日报君"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button onClick={submit} disabled={!handle.trim() || !displayName.trim()}>
            {isEdit ? '保存' : '添加'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
