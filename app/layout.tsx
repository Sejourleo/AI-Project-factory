import './globals.css'
import type { Metadata } from 'next'
import { Sora, Noto_Serif_SC, DM_Mono } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import { ToastProvider } from '@/components/studio/ui/ToastProvider'
import { AgentSwitcher } from '@/components/agent-switcher'

const sora = Sora({ subsets: ['latin'], variable: '--font-sora' })
const notoSerifSC = Noto_Serif_SC({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-noto-serif-sc' })
const dmMono = DM_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-dm-mono' })

export const metadata: Metadata = {
  title: '内容工厂',
  description: '内容采集、选题分析与多平台创作工具',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={`${sora.variable} ${notoSerifSC.variable} ${dmMono.variable}`}>
      <body className="antialiased bg-neutral-50 text-neutral-900">
        <AgentSwitcher />
        {children}
        <Toaster richColors position="top-right" />
        <ToastProvider />
      </body>
    </html>
  )
}
