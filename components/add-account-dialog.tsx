'use client'

import { useState } from 'react'
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

export function AddAccountDialog({
  onAdd,
}: {
  onAdd: (a: { platform: Platform; handle: string; displayName: string }) => void
}) {
  const [open, setOpen] = useState(false)
  const [platform, setPlatform] = useState<Platform>('bilibili')
  const [handle, setHandle] = useState('')
  const [displayName, setDisplayName] = useState('')

  function reset() {
    setHandle('')
    setDisplayName('')
    setPlatform('bilibili')
  }

  function submit() {
    if (!handle.trim() || !displayName.trim()) return
    onAdd({ platform, handle: handle.trim(), displayName: displayName.trim() })
    setOpen(false)
    reset()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-100 text-sm text-neutral-700 hover:bg-neutral-200/70 transition-colors">
            <UserPlus size={14} />
            新增博主
          </button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新增对标博主</DialogTitle>
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
            添加
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
