'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const TABS = [
  { id: 'content',  label: '内容' },
  { id: 'history',  label: '查询历史' },
  { id: 'reports',  label: '选题分析' },
  { id: 'settings', label: '监控设置' },
]

export function TabNav({ categoryId }: { categoryId: string }) {
  const pathname = usePathname()
  return (
    <div className="px-8 bg-white flex gap-8">
      {TABS.map((t) => {
        const href = `/c/${categoryId}/${t.id}`
        const active = pathname.startsWith(href)
        return (
          <Link
            key={t.id}
            href={href}
            className={cn(
              'py-4 text-sm border-b-2 transition-colors',
              active
                ? 'border-neutral-900 text-neutral-900 font-medium'
                : 'border-transparent text-neutral-400 hover:text-neutral-700'
            )}
          >
            {t.label}
          </Link>
        )
      })}
    </div>
  )
}
