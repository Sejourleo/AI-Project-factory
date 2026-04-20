'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Boxes } from 'lucide-react'
import { useCategories } from '@/components/categories-provider'
import { CreateCategoryDialog } from '@/components/create-category-dialog'
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
          {categories.map((c) => {
            const active = pathname.startsWith(`/c/${c.id}`)
            return (
              <Link
                key={c.id}
                href={`/c/${c.id}/content`}
                className={cn(
                  'flex items-center gap-2.5 px-3.5 py-2.5 text-sm rounded-lg transition-colors',
                  active
                    ? 'bg-neutral-900 text-white font-medium shadow-sm'
                    : 'text-neutral-700 hover:bg-neutral-100/80'
                )}
              >
                <span
                  className="inline-block size-2 rounded-full shrink-0"
                  style={{ backgroundColor: c.color }}
                />
                <span className="truncate">{c.name}</span>
              </Link>
            )
          })}
        </nav>
        <div className="mt-4 px-1">
          <CreateCategoryDialog />
        </div>
      </div>
    </aside>
  )
}
