// components/nav/TopNav.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/', label: '首页' },
  { href: '/settings', label: '设置' },
];

export function TopNav() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }

  return (
    <header className="fixed top-0 inset-x-0 z-40 h-14 bg-[var(--color-bg)]/80 backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-6">
        <Link href="/" className="font-serif text-lg tracking-tight">
          内容工厂
        </Link>
        <nav className="flex items-center gap-1">
          {links.map(l => (
            <Link
              key={l.href}
              href={l.href}
              className={
                'px-3 py-1.5 rounded-md text-sm transition-colors ' +
                (isActive(l.href)
                  ? 'text-[var(--color-fg)] bg-[var(--color-surface)]'
                  : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]')
              }
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
