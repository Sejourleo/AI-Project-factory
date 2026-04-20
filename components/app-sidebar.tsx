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
    <aside className="w-60 shrink-0 border-r border-neutral-200 bg-white flex flex-col">
      <div className="h-14 px-4 flex items-center gap-2 border-b border-neutral-200">
        <Boxes size={18} />
        <span className="font-semibold">内容工厂</span>
      </div>
      <div className="p-3 flex-1 overflow-y-auto">
        <div className="text-[10px] uppercase tracking-wide text-neutral-400 mb-2 px-2">
          监控分类
        </div>
        <nav className="space-y-1">
          {categories.map((c) => {
            const active = pathname.startsWith(`/c/${c.id}`)
            return (
              <Link
                key={c.id}
                href={`/c/${c.id}/content`}
                className={cn(
                  'block px-3 py-2 text-sm rounded-md transition-colors',
                  active
                    ? 'bg-neutral-900 text-white font-medium'
                    : 'text-neutral-700 hover:bg-neutral-100'
                )}
              >
                {c.name}
              </Link>
            )
          })}
        </nav>
        <div className="mt-3">
          <CreateCategoryDialog />
        </div>
      </div>
    </aside>
  )
}
