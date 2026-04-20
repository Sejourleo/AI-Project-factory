'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const TABS = [
  { id: 'content',  label: '内容' },
  { id: 'reports',  label: '选题分析' },
  { id: 'settings', label: '监控设置' },
]

export function TabNav({ categoryId }: { categoryId: string }) {
  const pathname = usePathname()
  return (
    <div className="px-6 border-b border-neutral-200 bg-white flex gap-6">
      {TABS.map((t) => {
        const href = `/c/${categoryId}/${t.id}`
        const active = pathname.startsWith(href)
        return (
          <Link
            key={t.id}
            href={href}
            className={cn(
              'py-3 text-sm border-b-2 transition-colors',
              active
                ? 'border-neutral-900 text-neutral-900 font-medium'
                : 'border-transparent text-neutral-500 hover:text-neutral-900'
            )}
          >
            {t.label}
          </Link>
        )
      })}
    </div>
  )
}
