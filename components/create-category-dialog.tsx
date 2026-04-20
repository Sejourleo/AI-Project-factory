'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus } from 'lucide-react'
import { useCategories } from '@/components/categories-provider'
import { toast } from 'sonner'

export function CreateCategoryDialog() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const { addCategory } = useCategories()
  const router = useRouter()

  function handleCreate() {
    const trimmed = name.trim()
    if (!trimmed) return
    const c = addCategory(trimmed)
    toast.success(`已创建分类"${c.name}"`)
    setOpen(false)
    setName('')
    router.push(`/c/${c.id}/content`)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button className="w-full text-left px-3.5 py-2.5 text-sm text-neutral-500 rounded-lg hover:bg-neutral-100/80 hover:text-neutral-700 flex items-center gap-2.5 transition-colors">
            <Plus size={14} /> 新建分类
          </button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新建监控分类</DialogTitle>
          <DialogDescription>
            每个分类独立管理监控目标与选题报告。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="cat-name">分类名称</Label>
          <Input
            id="cat-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：AI 播客选题监控"
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>取消</Button>
          <Button onClick={handleCreate} disabled={!name.trim()}>创建</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
