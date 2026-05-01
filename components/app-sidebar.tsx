'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ContextMenu as ContextMenuPrimitive } from '@base-ui/react/context-menu'
import { Boxes, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useCategories } from '@/components/categories-provider'
import { CreateCategoryDialog } from '@/components/create-category-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Category } from '@/lib/types'
import { cn } from '@/lib/utils'

export function AppSidebar() {
  const { categories } = useCategories()
  const pathname = usePathname()

  return (
    <aside className="w-64 shrink-0 bg-white flex flex-col">
      <div className="h-16 px-6 flex items-center gap-2.5">
        <Boxes size={18} className="text-neutral-700" />
        <span className="font-semibold tracking-tight">内容工厂</span>
      </div>
      <div className="px-4 pt-2 pb-6 flex-1 overflow-y-auto">
        <div className="text-[11px] tracking-wider text-neutral-400 mb-3 px-3">
          监控分类
        </div>
        <nav className="space-y-1.5">
          {categories.map((c) => (
            <CategoryItem
              key={c.id}
              category={c}
              active={pathname.startsWith(`/c/${c.id}`)}
            />
          ))}
        </nav>
        <div className="mt-4 px-1">
          <CreateCategoryDialog />
        </div>
      </div>
    </aside>
  )
}

function CategoryItem({ category, active }: { category: Category; active: boolean }) {
  const { categories, renameCategory, removeCategory } = useCategories()
  const router = useRouter()
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [renameValue, setRenameValue] = useState(category.name)

  function openRename() {
    setRenameValue(category.name)
    setRenameOpen(true)
  }

  function handleRename() {
    const trimmed = renameValue.trim()
    if (!trimmed || trimmed === category.name) {
      setRenameOpen(false)
      return
    }
    renameCategory(category.id, trimmed)
    toast.success(`已重命名为"${trimmed}"`)
    setRenameOpen(false)
  }

  function handleDelete() {
    const remaining = categories.filter((c) => c.id !== category.id)
    removeCategory(category.id)
    toast.success(`已删除"${category.name}"`)
    setDeleteOpen(false)
    if (active) {
      if (remaining.length > 0) {
        router.replace(`/c/${remaining[0].id}/content`)
      } else {
        router.replace('/')
      }
    }
  }

  return (
    <>
      <ContextMenuPrimitive.Root>
        <ContextMenuPrimitive.Trigger
          render={
            <Link
              href={`/c/${category.id}/content`}
              className={cn(
                'flex items-center gap-2.5 px-3.5 py-2.5 text-sm rounded-lg transition-colors',
                active
                  ? 'bg-neutral-900 text-white font-medium shadow-sm'
                  : 'text-neutral-700 hover:bg-neutral-100/80'
              )}
            >
              <span
                className="inline-block size-2 rounded-full shrink-0"
                style={{ backgroundColor: category.color }}
              />
              <span className="truncate">{category.name}</span>
            </Link>
          }
        />
        <ContextMenuPrimitive.Portal>
          <ContextMenuPrimitive.Positioner className="outline-none">
            <ContextMenuPrimitive.Popup className="bg-white rounded-lg shadow-lg ring-1 ring-black/5 py-1 min-w-[160px] outline-none text-sm text-neutral-700">
              <ContextMenuPrimitive.Item
                onClick={openRename}
                className="px-3 py-1.5 flex items-center gap-2 cursor-default hover:bg-neutral-100 outline-none"
              >
                <Pencil size={13} className="text-neutral-500" />
                重命名
              </ContextMenuPrimitive.Item>
              <ContextMenuPrimitive.Item
                onClick={() => setDeleteOpen(true)}
                className="px-3 py-1.5 flex items-center gap-2 cursor-default hover:bg-red-50 text-red-600 outline-none"
              >
                <Trash2 size={13} />
                删除
              </ContextMenuPrimitive.Item>
            </ContextMenuPrimitive.Popup>
          </ContextMenuPrimitive.Positioner>
        </ContextMenuPrimitive.Portal>
      </ContextMenuPrimitive.Root>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重命名分类</DialogTitle>
            <DialogDescription>为这个监控分类起一个新名字。</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`rename-${category.id}`}>分类名称</Label>
            <Input
              id={`rename-${category.id}`}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameOpen(false)}>取消</Button>
            <Button onClick={handleRename} disabled={!renameValue.trim()}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除分类</DialogTitle>
            <DialogDescription>
              确定要删除"{category.name}"吗？该分类下的配置将一并移除，操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>取消</Button>
            <Button
              onClick={handleDelete}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
