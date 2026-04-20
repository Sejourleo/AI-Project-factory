import './globals.css'
import type { Metadata } from 'next'
import { Toaster } from '@/components/ui/sonner'
import { CategoriesProvider } from '@/components/categories-provider'
import { AppSidebar } from '@/components/app-sidebar'

export const metadata: Metadata = {
  title: '内容工厂',
  description: '内容监控与选题分析工具',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="antialiased bg-neutral-50 text-neutral-900">
        <CategoriesProvider>
          <div className="flex min-h-screen">
            <AppSidebar />
            <main className="flex-1 flex flex-col min-w-0">{children}</main>
          </div>
        </CategoriesProvider>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
