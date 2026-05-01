'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function AgentSwitcher() {
  const pathname = usePathname() ?? '/'
  const isMonitor = pathname === '/' || pathname.startsWith('/c/')
  const isStudio = pathname.startsWith('/studio')

  return (
    <header className="sticky top-0 z-50 h-14 bg-white/90 backdrop-blur-md border-b border-neutral-200">
      <div className="mx-auto h-full max-w-[1400px] px-6 flex items-center gap-6">
        <Link href="/" className="font-semibold tracking-tight text-neutral-900">
          内容工厂
        </Link>

        <nav className="flex items-center gap-1.5">
          <Link
            href="/"
            className={
              'px-3.5 py-1.5 rounded-full text-sm transition-colors ' +
              (isMonitor
                ? 'bg-neutral-900 text-white'
                : 'text-neutral-600 hover:bg-neutral-100')
            }
          >
            内容采集与选题创作 Agent
          </Link>
          <Link
            href="/studio"
            className={
              'px-3.5 py-1.5 rounded-full text-sm transition-colors ' +
              (isStudio
                ? 'bg-neutral-900 text-white'
                : 'text-neutral-600 hover:bg-neutral-100')
            }
          >
            内容创作 Agent
          </Link>
        </nav>

        <div className="ml-auto flex items-center">
          {isStudio && (
            <Link
              href="/studio/settings"
              className="text-sm text-neutral-600 hover:text-neutral-900 px-2 py-1"
            >
              设置
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
