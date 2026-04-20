# 内容监控工具前端原型 · 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付可本地运行的内容监控工具前端原型，含分类管理、三个 Tab（内容 / 选题分析 / 监控设置）、假数据、为将来接后端预留的数据访问层。

**Architecture:** Next.js 15 App Router 单页多路由应用。所有页面 `'use client'`，数据通过 `lib/data/*.ts` 的 async 函数访问（现阶段读 fixtures、将来换 fetch）；分类的增删与设置修改通过 React Context 保持 session 内内存状态。UI 组件基于 shadcn/ui。

**Tech Stack:** Next.js 15（App Router）、React 19、TypeScript、Tailwind CSS v4、shadcn/ui、lucide-react、dayjs、sonner（toast）、Vitest（仅用于 data/utils 单元测试）。

**Spec:** `docs/superpowers/specs/2026-04-20-content-monitor-prototype-design.md`

**测试策略说明：** 这是前端原型。TDD 仅用于纯逻辑层（`lib/data/*.ts`、`lib/utils/*.ts`）。UI 组件不写自动化测试，在最后一步通过 `npm run dev` 人工验证各页面功能。

---

## File Structure

```
内容工厂/
├── app/
│   ├── layout.tsx                   # 根布局：Sidebar + Header + 主区 + Toaster
│   ├── page.tsx                     # 根路由 → 重定向到第一个分类
│   ├── globals.css                  # Tailwind + CSS 变量
│   └── c/
│       └── [categoryId]/
│           ├── layout.tsx           # 分类内部布局：顶部 Tabs
│           ├── page.tsx             # → 重定向到 content
│           ├── content/page.tsx     # Tab 1
│           ├── reports/page.tsx     # Tab 2
│           └── settings/page.tsx    # Tab 3
├── components/
│   ├── categories-provider.tsx      # React Context: 分类列表 + 增改
│   ├── app-sidebar.tsx              # 左侧分类栏
│   ├── create-category-dialog.tsx   # "新建分类"弹窗
│   ├── tab-nav.tsx                  # 顶部 3 个 Tab
│   ├── platform-filter.tsx          # Tab 1: 平台 Pills 筛选
│   ├── date-strip.tsx               # Tab 1 + Tab 2 共用日期卡片
│   ├── content-grid.tsx             # Tab 1: 内容卡片网格
│   ├── content-card.tsx             # 单个内容卡片（完整 + 紧凑版）
│   ├── report-list.tsx              # Tab 2 左栏报告索引
│   ├── report-viewer.tsx            # Tab 2 右主报告阅读区
│   ├── topic-card.tsx               # 选题卡片（Tab 2 两个视图共用）
│   ├── topics-aggregate-view.tsx    # Tab 2 "按选题"聚合视图
│   ├── settings-form.tsx            # Tab 3 主表单
│   ├── add-account-dialog.tsx       # Tab 3 "新增博主"弹窗
│   └── ui/                          # shadcn 组件（自动生成）
├── lib/
│   ├── types.ts                     # 所有 TS 类型 + PLATFORMS 常量
│   ├── utils.ts                     # shadcn 默认 cn 工具
│   ├── data/
│   │   ├── categories.ts            # getCategories / getCategoryById
│   │   ├── contents.ts              # getContentsByDate / getDateBuckets / getPlatformCounts
│   │   └── reports.ts               # getReportList / getReportByDate / getTopicsByRange / regenerateReport
│   ├── fixtures/
│   │   ├── categories.ts            # 3 个分类 + 监控设置
│   │   ├── contents.ts              # ~14 天 × 3 分类 × 15-25 条/天
│   │   └── reports.ts               # 7 天 × 3 分类 × 3-5 选题
│   └── utils/
│       └── dates.ts                 # 日期工具（today / yesterday / formatDow / pastNDays）
├── tests/
│   ├── data/
│   │   ├── categories.test.ts
│   │   ├── contents.test.ts
│   │   └── reports.test.ts
│   └── utils/
│       └── dates.test.ts
├── package.json
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs
├── vitest.config.ts
├── components.json                  # shadcn 配置
└── README.md
```

---

### Task 1: 初始化 Next.js 项目骨架

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `next-env.d.ts`

- [ ] **Step 1: 创建 package.json**

Create `package.json`:
```json
{
  "name": "content-monitor-prototype",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "next": "15.1.6",
    "react": "19.0.0",
    "react-dom": "19.0.0"
  },
  "devDependencies": {
    "@types/node": "^22",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "typescript": "^5"
  }
}
```

- [ ] **Step 2: 创建 tsconfig.json**

Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: 创建 next.config.ts**

Create `next.config.ts`:
```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'picsum.photos' },
    ],
  },
}

export default nextConfig
```

- [ ] **Step 4: 创建 next-env.d.ts**

Create `next-env.d.ts`:
```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />
```

- [ ] **Step 5: 创建 app/layout.tsx 占位**

Create `app/layout.tsx`:
```tsx
import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '内容工厂',
  description: '内容监控与选题分析工具',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  )
}
```

- [ ] **Step 6: 创建 app/page.tsx 占位**

Create `app/page.tsx`:
```tsx
export default function Home() {
  return <div className="p-8">内容工厂（脚手架就绪）</div>
}
```

- [ ] **Step 7: 创建 app/globals.css 占位**

Create `app/globals.css`:
```css
@import "tailwindcss";
```

- [ ] **Step 8: 创建 postcss.config.mjs**

Create `postcss.config.mjs`:
```js
export default { plugins: ['@tailwindcss/postcss'] }
```

- [ ] **Step 9: 安装依赖**

Run: `npm install`
Expected: `node_modules/` created, no errors. 如果 Next 版本不可解析，改用 `npm install next@latest react@latest react-dom@latest`。

- [ ] **Step 10: 安装 Tailwind v4**

Run: `npm install -D tailwindcss @tailwindcss/postcss`
Expected: 安装成功。

- [ ] **Step 11: 启动 dev 服务器验证**

Run: `npm run dev`
Expected: `http://localhost:3000` 显示"内容工厂（脚手架就绪）"。Ctrl+C 退出。

- [ ] **Step 12: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.ts next-env.d.ts postcss.config.mjs app/
git commit -m "scaffold: Next.js 15 + Tailwind v4 基础骨架"
```

---

### Task 2: 添加 shadcn/ui + 周边依赖

**Files:**
- Create: `components.json`, `lib/utils.ts`, `components/ui/*`（通过 shadcn 生成）
- Modify: `app/globals.css`（shadcn 会注入主题变量）

- [ ] **Step 1: 初始化 shadcn/ui**

Run: `npx shadcn@latest init -d`
交互式选项出现时全部选默认（Style: New York；Base color: Neutral；CSS variables: yes）。

Expected: 生成 `components.json`、`lib/utils.ts`、覆写 `app/globals.css`（含 `@theme`/CSS 变量）。

- [ ] **Step 2: 安装常用 shadcn 组件**

Run:
```bash
npx shadcn@latest add button card input badge tabs switch dialog toggle-group label textarea separator sonner
```
Expected: `components/ui/` 下出现对应文件。

- [ ] **Step 3: 安装其他依赖**

Run: `npm install dayjs lucide-react`
Expected: 安装完成。

- [ ] **Step 4: 安装 Vitest + 类型**

Run: `npm install -D vitest @vitest/ui`
Expected: 安装完成。

- [ ] **Step 5: 创建 vitest.config.ts**

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
```

- [ ] **Step 6: 把 Toaster 挂进根布局**

Modify `app/layout.tsx` body 部分为：
```tsx
<body className="antialiased">
  {children}
  <Toaster richColors position="top-right" />
</body>
```
并在顶部 import:
```tsx
import { Toaster } from '@/components/ui/sonner'
```

- [ ] **Step 7: 验证构建无错**

Run: `npm run build`
Expected: 构建成功。若 shadcn 组件有缺失依赖，`npm install` 补齐。

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json components.json vitest.config.ts lib/ components/ui/ app/globals.css app/layout.tsx
git commit -m "setup: 引入 shadcn/ui、lucide-react、dayjs、sonner、vitest"
```

---

### Task 3: 定义类型与平台常量

**Files:**
- Create: `lib/types.ts`

- [ ] **Step 1: 写 lib/types.ts**

Create `lib/types.ts`:
```ts
export type Platform = 'douyin' | 'xiaohongshu' | 'weibo' | 'bilibili'

export const PLATFORMS: Array<{ id: Platform; name: string; color: string }> = [
  { id: 'douyin',      name: '抖音',   color: '#000000' },
  { id: 'xiaohongshu', name: '小红书', color: '#FE2C55' },
  { id: 'weibo',       name: '微博',   color: '#E6162D' },
  { id: 'bilibili',    name: 'B站',    color: '#FB7299' },
]

export type MonitorSettings = {
  platforms: Platform[]
  keywords: string[]
  accounts: Array<{
    platform: Platform
    handle: string
    displayName: string
  }>
}

export type Category = {
  id: string
  name: string
  createdAt: string
  settings: MonitorSettings
}

export type ContentItem = {
  id: string
  categoryId: string
  platform: Platform
  title: string
  author: string
  publishedAt: string
  collectedAt: string
  url: string
  coverImage?: string
  stats: { likes: number; comments: number; shares: number }
  hotScore: number
  matchedBy: { type: 'keyword' | 'account'; value: string }
}

export type TopicSuggestion = {
  id: string
  title: string
  brief: {
    why: string
    hook: string
    growth: string
  }
  tags: string[]
  relatedContentIds: string[]
}

export type DailyReport = {
  id: string
  categoryId: string
  date: string
  summary: string
  yesterdayHotspots: string[]
  topics: TopicSuggestion[]
  analyzedContentIds: string[]
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/types.ts
git commit -m "types: 定义 Platform/Category/ContentItem/DailyReport 等核心类型"
```

---

### Task 4: 日期工具函数（TDD）

**Files:**
- Create: `lib/utils/dates.ts`
- Test: `tests/utils/dates.test.ts`

- [ ] **Step 1: 写测试**

Create `tests/utils/dates.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { today, yesterday, pastNDays, formatDow } from '@/lib/utils/dates'

describe('dates utils', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-20T12:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('today() 返回 YYYY-MM-DD 格式的今天', () => {
    expect(today()).toBe('2026-04-20')
  })

  it('yesterday() 返回昨天', () => {
    expect(yesterday()).toBe('2026-04-19')
  })

  it('pastNDays(14) 返回过去 14 天（含今天），按时间升序', () => {
    const days = pastNDays(14)
    expect(days).toHaveLength(14)
    expect(days[0]).toBe('2026-04-07')
    expect(days[13]).toBe('2026-04-20')
  })

  it('formatDow 对给定日期返回中文星期', () => {
    expect(formatDow('2026-04-20')).toBe('周一')
    expect(formatDow('2026-04-19')).toBe('周日')
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npm test -- tests/utils/dates.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现**

Create `lib/utils/dates.ts`:
```ts
import dayjs from 'dayjs'

export function today(): string {
  return dayjs().format('YYYY-MM-DD')
}

export function yesterday(): string {
  return dayjs().subtract(1, 'day').format('YYYY-MM-DD')
}

export function pastNDays(n: number): string[] {
  const result: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    result.push(dayjs().subtract(i, 'day').format('YYYY-MM-DD'))
  }
  return result
}

const DOW_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
export function formatDow(date: string): string {
  return DOW_CN[dayjs(date).day()]
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npm test -- tests/utils/dates.test.ts`
Expected: 4 PASS。

- [ ] **Step 5: Commit**

```bash
git add lib/utils/dates.ts tests/utils/dates.test.ts
git commit -m "utils: 日期工具函数 today/yesterday/pastNDays/formatDow"
```

---

### Task 5: 分类假数据 + 分类 Context

**Files:**
- Create: `lib/fixtures/categories.ts`, `components/categories-provider.tsx`

- [ ] **Step 1: 写 categories fixture**

Create `lib/fixtures/categories.ts`:
```ts
import type { Category } from '@/lib/types'

export const CATEGORIES_SEED: Category[] = [
  {
    id: 'claudecode',
    name: 'ClaudeCode 选题监控',
    createdAt: '2026-03-01',
    settings: {
      platforms: ['douyin', 'xiaohongshu', 'weibo', 'bilibili'],
      keywords: ['Claude Code', 'Anthropic', 'AI 编程助手', 'MCP', 'Subagent', 'Claude 工作流'],
      accounts: [
        { platform: 'bilibili',    handle: 'ai-coder-01',   displayName: 'AI 编程老王' },
        { platform: 'xiaohongshu', handle: 'vibecode_girl', displayName: 'Vibe Coding 小姐姐' },
        { platform: 'weibo',       handle: 'prompt_dad',    displayName: 'Prompt 老爸' },
      ],
    },
  },
  {
    id: 'vibecoding',
    name: 'Vibecoding 选题监控',
    createdAt: '2026-03-10',
    settings: {
      platforms: ['xiaohongshu', 'weibo', 'bilibili'],
      keywords: ['Vibe Coding', 'AI 结对编程', 'Cursor', '氛围编程'],
      accounts: [
        { platform: 'bilibili',    handle: 'fe-with-ai',    displayName: '前端 AI 玩家' },
        { platform: 'xiaohongshu', handle: 'nocode_lady',   displayName: '低代码女孩' },
      ],
    },
  },
  {
    id: 'ai-product',
    name: 'AI 产品监控',
    createdAt: '2026-03-15',
    settings: {
      platforms: ['douyin', 'xiaohongshu', 'weibo', 'bilibili'],
      keywords: ['AI Agent', 'AI 助手', 'ChatGPT', 'AI 产品', 'LLM 应用'],
      accounts: [
        { platform: 'weibo',    handle: 'ai_watcher',    displayName: 'AI 产品观察' },
        { platform: 'bilibili', handle: 'tech_reviewer', displayName: '硬核测评师' },
        { platform: 'douyin',   handle: 'ai_daily',      displayName: 'AI 日报君' },
      ],
    },
  },
]
```

- [ ] **Step 2: 写 CategoriesProvider**

Create `components/categories-provider.tsx`:
```tsx
'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import type { Category, MonitorSettings } from '@/lib/types'
import { CATEGORIES_SEED } from '@/lib/fixtures/categories'
import { today } from '@/lib/utils/dates'

type Ctx = {
  categories: Category[]
  getById: (id: string) => Category | undefined
  addCategory: (name: string) => Category
  updateSettings: (id: string, settings: MonitorSettings) => void
}

const CategoriesContext = createContext<Ctx | null>(null)

export function CategoriesProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<Category[]>(CATEGORIES_SEED)

  const getById = useCallback(
    (id: string) => categories.find((c) => c.id === id),
    [categories]
  )

  const addCategory = useCallback((name: string): Category => {
    const id = `cat-${Date.now()}`
    const created: Category = {
      id,
      name,
      createdAt: today(),
      settings: {
        platforms: ['douyin', 'xiaohongshu', 'weibo', 'bilibili'],
        keywords: [],
        accounts: [],
      },
    }
    setCategories((prev) => [...prev, created])
    return created
  }, [])

  const updateSettings = useCallback((id: string, settings: MonitorSettings) => {
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, settings } : c))
    )
  }, [])

  return (
    <CategoriesContext.Provider value={{ categories, getById, addCategory, updateSettings }}>
      {children}
    </CategoriesContext.Provider>
  )
}

export function useCategories(): Ctx {
  const ctx = useContext(CategoriesContext)
  if (!ctx) throw new Error('useCategories must be used inside <CategoriesProvider>')
  return ctx
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/fixtures/categories.ts components/categories-provider.tsx
git commit -m "categories: 假数据 + Context Provider"
```

---

### Task 6: 内容假数据生成 + 数据访问（TDD）

**Files:**
- Create: `lib/fixtures/contents.ts`, `lib/data/contents.ts`
- Test: `tests/data/contents.test.ts`

- [ ] **Step 1: 写内容 fixture 生成逻辑**

Create `lib/fixtures/contents.ts`:
```ts
import type { ContentItem, Platform } from '@/lib/types'
import { CATEGORIES_SEED } from './categories'
import { pastNDays } from '@/lib/utils/dates'

const TITLE_TEMPLATES: Record<string, string[]> = {
  claudecode: [
    'Claude Code 彻底改变了我的独立开发流程',
    '我用 Claude Code 一天做完三个 MVP',
    'MCP 工具链入门：从零到接管你的开发环境',
    '三个 Subagent 模板让我效率翻倍',
    'Claude Hooks 系统深度拆解',
    '为什么说 Claude Code 是目前最好的 AI IDE',
    '我和 Claude Code 的 30 天工作日记',
    'Claude Agent SDK 实战：搭建自己的 AI 助手',
    'Cursor vs Claude Code 全面对比',
    '从 0 到 1 用 Claude Code 做一个 SaaS',
    'Claude Code 进阶技巧合集',
    '独立开发者必看：Claude Code 配置指南',
  ],
  vibecoding: [
    'Vibe Coding 正在成为新的编程范式',
    '什么是氛围编程？我来告诉你',
    '用 AI 结对编程一个月后的真实体验',
    '前端工程师的 Vibe Coding 实践',
    '低代码时代，程序员的出路在哪',
    'Cursor + Claude：我的 Vibe 工作台搭建',
    '10 个 Vibe Coding 必备 Prompt',
    '为什么传统程序员瞧不起 Vibe Coding',
  ],
  'ai-product': [
    '2026 年不容错过的 AI 产品盘点',
    '深度测评：这款 AI Agent 真的做到了 24 小时办公',
    'ChatGPT 新功能实测：值得付费吗',
    'AI Agent 的第一批商业化产品出现了',
    '从 Chat 到 Agent：AI 产品形态的演进',
    'LLM 应用开发现状与趋势',
    '大厂的 AI 产品到底赚钱吗',
    'AI 助手选型指南：个人用户版',
  ],
}

const AUTHORS = [
  '编程阿强',  '独立开发日记',  '前端老炮',  'AI 观察者',
  '硬核极客',  '产品老师',  '代码诗人',  'Prompt 研究员',
  '技术圆桌',  '数字游民',
]

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length]
}

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

function generateForDay(
  categoryId: string,
  date: string,
  dayIndex: number
): ContentItem[] {
  const cat = CATEGORIES_SEED.find((c) => c.id === categoryId)!
  const titles = TITLE_TEMPLATES[categoryId] ?? TITLE_TEMPLATES.claudecode
  const platforms: Platform[] = cat.settings.platforms
  const count = 15 + (hash(`${categoryId}-${date}`) % 11)  // 15-25 条

  const items: ContentItem[] = []
  for (let i = 0; i < count; i++) {
    const seed = hash(`${categoryId}-${date}-${i}`)
    const platform = pick(platforms, seed)
    const title = pick(titles, seed + i)
    const author = pick(AUTHORS, seed + i * 3)
    const useKeyword = (seed % 2) === 0
    const matchedBy = useKeyword
      ? { type: 'keyword' as const, value: pick(cat.settings.keywords, seed) }
      : { type: 'account' as const, value: pick(cat.settings.accounts, seed).displayName }

    const hotScore =
      i === 0 || i === 1 ? 90 + (seed % 10)            // Top 2 高热
        : i < count * 0.3 ? 60 + (seed % 30)            // 中热
          : 20 + (seed % 40)                             // 低热

    items.push({
      id: `${categoryId}-${date}-${i}`,
      categoryId,
      platform,
      title: `${title}${i % 5 === 0 ? '（干货版）' : ''}`,
      author,
      publishedAt: `${date}T${String(8 + (i % 12)).padStart(2, '0')}:00:00Z`,
      collectedAt: `${date}T23:00:00Z`,
      url: `https://example.com/${platform}/${categoryId}-${date}-${i}`,
      coverImage: `https://picsum.photos/seed/${categoryId}-${date}-${i}/640/360`,
      stats: {
        likes:    100 + seed % 50000,
        comments: 10 + seed % 2000,
        shares:   5  + seed % 800,
      },
      hotScore,
      matchedBy,
    })
  }
  return items.sort((a, b) => b.hotScore - a.hotScore)
}

export const CONTENTS_SEED: ContentItem[] = (() => {
  const days = pastNDays(14)
  const items: ContentItem[] = []
  for (const cat of CATEGORIES_SEED) {
    for (let d = 0; d < days.length; d++) {
      items.push(...generateForDay(cat.id, days[d], d))
    }
  }
  return items
})()
```

- [ ] **Step 2: 写测试**

Create `tests/data/contents.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getContentsByDate, getDateBuckets, getPlatformCounts } from '@/lib/data/contents'
import type { Platform } from '@/lib/types'

describe('contents data access', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-20T12:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('getContentsByDate 返回指定分类 + 日期的内容，且按 hotScore 降序', async () => {
    const items = await getContentsByDate('claudecode', '2026-04-19')
    expect(items.length).toBeGreaterThan(0)
    expect(items.every((i) => i.categoryId === 'claudecode')).toBe(true)
    expect(items.every((i) => i.collectedAt.startsWith('2026-04-19'))).toBe(true)
    for (let i = 1; i < items.length; i++) {
      expect(items[i - 1].hotScore).toBeGreaterThanOrEqual(items[i].hotScore)
    }
  })

  it('getContentsByDate 可按平台筛选', async () => {
    const platforms: Platform[] = ['douyin', 'weibo']
    const items = await getContentsByDate('claudecode', '2026-04-19', platforms)
    expect(items.every((i) => platforms.includes(i.platform))).toBe(true)
  })

  it('getDateBuckets 返回过去 14 天，每天带计数，升序', async () => {
    const buckets = await getDateBuckets('claudecode', 14)
    expect(buckets).toHaveLength(14)
    expect(buckets[0].date).toBe('2026-04-07')
    expect(buckets[13].date).toBe('2026-04-20')
    expect(buckets.every((b) => b.count >= 0)).toBe(true)
  })

  it('getPlatformCounts 返回各平台当日条数，包含未出现的平台为 0', async () => {
    const counts = await getPlatformCounts('claudecode', '2026-04-19')
    expect(Object.keys(counts).sort()).toEqual(['bilibili', 'douyin', 'weibo', 'xiaohongshu'])
    const total = counts.douyin + counts.xiaohongshu + counts.weibo + counts.bilibili
    const all = await getContentsByDate('claudecode', '2026-04-19')
    expect(total).toBe(all.length)
  })
})
```

- [ ] **Step 3: 运行测试验证失败**

Run: `npm test -- tests/data/contents.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 4: 实现**

Create `lib/data/contents.ts`:
```ts
import type { ContentItem, Platform } from '@/lib/types'
import { CONTENTS_SEED } from '@/lib/fixtures/contents'
import { pastNDays } from '@/lib/utils/dates'

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export async function getContentsByDate(
  categoryId: string,
  date: string,
  platforms?: Platform[]
): Promise<ContentItem[]> {
  // TODO(api): GET /api/contents?categoryId=...&date=...&platforms=...
  await sleep(50)
  return CONTENTS_SEED
    .filter((c) => c.categoryId === categoryId && c.collectedAt.startsWith(date))
    .filter((c) => !platforms || platforms.length === 0 || platforms.includes(c.platform))
    .sort((a, b) => b.hotScore - a.hotScore)
}

export async function getDateBuckets(
  categoryId: string,
  days = 14
): Promise<Array<{ date: string; count: number }>> {
  // TODO(api): GET /api/contents/buckets?categoryId=...&days=...
  await sleep(30)
  const dates = pastNDays(days)
  return dates.map((date) => ({
    date,
    count: CONTENTS_SEED.filter(
      (c) => c.categoryId === categoryId && c.collectedAt.startsWith(date)
    ).length,
  }))
}

export async function getPlatformCounts(
  categoryId: string,
  date: string
): Promise<Record<Platform, number>> {
  // TODO(api): GET /api/contents/platform-counts?categoryId=...&date=...
  await sleep(20)
  const result: Record<Platform, number> = {
    douyin: 0, xiaohongshu: 0, weibo: 0, bilibili: 0,
  }
  for (const c of CONTENTS_SEED) {
    if (c.categoryId === categoryId && c.collectedAt.startsWith(date)) {
      result[c.platform] += 1
    }
  }
  return result
}
```

- [ ] **Step 5: 运行测试验证通过**

Run: `npm test -- tests/data/contents.test.ts`
Expected: 4 PASS。

- [ ] **Step 6: Commit**

```bash
git add lib/fixtures/contents.ts lib/data/contents.ts tests/data/contents.test.ts
git commit -m "data: contents 假数据 + 访问函数（含 TDD 测试）"
```

---

### Task 7: 报告假数据 + 数据访问（TDD）

**Files:**
- Create: `lib/fixtures/reports.ts`, `lib/data/reports.ts`, `lib/data/categories.ts`
- Test: `tests/data/reports.test.ts`, `tests/data/categories.test.ts`

- [ ] **Step 1: 写报告 fixture**

Create `lib/fixtures/reports.ts`:
```ts
import type { DailyReport, TopicSuggestion } from '@/lib/types'
import { CATEGORIES_SEED } from './categories'
import { pastNDays } from '@/lib/utils/dates'

const TOPIC_LIB: Record<string, Array<Omit<TopicSuggestion, 'id' | 'relatedContentIds'>>> = {
  claudecode: [
    {
      title: 'Claude Code 独立开发者工作流全拆解',
      brief: {
        why:    '独立开发者是 Claude Code 的核心增长人群，对完整工作流内容需求旺盛。',
        hook:   '"一人一天做完一个 MVP"的真实案例，可视化对比传统开发耗时。',
        growth: '视频 + 配套模板下载，评论区转化率高，相关搜索词月增 120%。',
      },
      tags: ['工作流', '独立开发', '入门教程'],
    },
    {
      title: 'MCP 工具链入门：从零到接管你的开发环境',
      brief: {
        why:    'MCP 是 Claude Code 生态最快速增长的技术话题，但入门门槛让大量用户被劝退。',
        hook:   '"5 分钟装好第一个 MCP Server" 的短视频拆解，降低认知门槛。',
        growth: '技术型账号容易建立专业度，适合系列化内容铺排。',
      },
      tags: ['MCP', '入门教程', '技术拆解'],
    },
    {
      title: '三款神级 Subagent 拆解',
      brief: {
        why:    'Subagent 是近期讨论度最高的 Claude 新特性，用户需要具体模板参考。',
        hook:   '"别人家的 Subagent 配置"系列，对比呈现产出效果差异。',
        growth: '模板下载能做私域转化，长尾价值高。',
      },
      tags: ['Subagent', '模板', '工作流'],
    },
    {
      title: 'Claude Hooks 系统深度拆解',
      brief: {
        why:    'Hooks 让 Claude Code 可编程化，是进阶用户的分水岭，高阶用户需求旺盛。',
        hook:   '"用 Hooks 让 Claude 自动 commit 并推送"这类具体场景示范。',
        growth: '配合 GitHub 开源模板，能吸引技术社区。',
      },
      tags: ['Hooks', '进阶', '自动化'],
    },
    {
      title: 'Cursor vs Claude Code 2026 深度对比',
      brief: {
        why:    '用户选型时的高频搜索主题，对比类内容天然传播性强。',
        hook:   '同一个任务用两款工具完成，量化耗时与代码质量。',
        growth: '争议性内容自带评论，账号互动数据可观。',
      },
      tags: ['对比评测', '选型', 'Cursor'],
    },
  ],
  vibecoding: [
    {
      title: 'Vibe Coding 正在重塑程序员的一天',
      brief: {
        why:    'Vibe Coding 概念刚被大众认识，科普类内容窗口期还在。',
        hook:   '"我放下键盘让 AI 写代码，自己去喝咖啡"的真实日程 vlog。',
        growth: '非程序员也能看懂，容易破圈。',
      },
      tags: ['科普', 'Vibe Coding', '日常'],
    },
    {
      title: '前端工程师的 Vibe Coding 实践指南',
      brief: {
        why:    '前端是 Vibe Coding 落地最快的领域，具体实践需求大。',
        hook:   '"3 小时搭完落地页，全程没写一行 CSS" 的案例拆解。',
        growth: '前端社区活跃度高，二次传播率好。',
      },
      tags: ['前端', '案例', '实操'],
    },
    {
      title: '用 AI 结对编程一个月后，我还有没有失业',
      brief: {
        why:    '存在感焦虑是程序员的普遍情绪，争议性话题流量高。',
        hook:   '"一个月后我的真实感受"，情绪 + 数据双重支撑。',
        growth: '能引发评论区长尾讨论。',
      },
      tags: ['观点', '职业发展', '争议'],
    },
    {
      title: '10 个 Vibe Coding 必备 Prompt 合集',
      brief: {
        why:    '实用工具型内容始终有稳定需求，收藏率高。',
        hook:   '"收藏就能直接用"的合集类视觉设计。',
        growth: '可做系列化，按场景细分。',
      },
      tags: ['Prompt', '工具', '合集'],
    },
  ],
  'ai-product': [
    {
      title: '2026 值得付费的 10 款 AI 产品',
      brief: {
        why:    '用户对付费 AI 产品的选型焦虑持续存在，年度榜单有流量惯性。',
        hook:   '真实付费使用 3 个月后的深度体感，而非 demo 体验。',
        growth: '可做成年度账号系列化 IP。',
      },
      tags: ['盘点', '付费', '选型'],
    },
    {
      title: '第一批 AI Agent 商业化产品深度测评',
      brief: {
        why:    'AI Agent 正从概念走向产品，早期测评有先发优势。',
        hook:   '"让它替我完成一天的工作，看能做到什么程度"。',
        growth: '能建立垂类测评号的专业度。',
      },
      tags: ['Agent', '测评', '商业化'],
    },
    {
      title: '从 Chat 到 Agent：AI 产品形态的演进逻辑',
      brief: {
        why:    '产品经理与投资人关注的框架性内容，专业受众付费意愿高。',
        hook:   '用一张演进图理清赛道，结构化叙述。',
        growth: '行业号转发率高，适合建立 thought leadership。',
      },
      tags: ['行业观察', '产品', '演进'],
    },
    {
      title: '大厂 AI 产品到底赚不赚钱',
      brief: {
        why:    '财报数据 + 商业分析能建立深度账号定位。',
        hook:   '拆解头部公司 AI 业务营收占比。',
        growth: '数据型内容易被引用与二次传播。',
      },
      tags: ['商业分析', '大厂', '营收'],
    },
  ],
}

const HOTSPOTS: Record<string, string[]> = {
  claudecode: [
    '独立开发者一人多角色工作流',
    'MCP 官方工具库更新',
    'Subagent 最佳实践模板流出',
    'Claude Hooks 自动化场景',
    'Claude Code vs Cursor 二次讨论',
  ],
  vibecoding: [
    'Cursor 新版插件体验',
    'AI 前端工程师的招聘需求',
    '低代码 vs Vibe Coding 争论',
    '非技术创始人用 AI 写代码',
  ],
  'ai-product': [
    'OpenAI 新产品发布',
    'AI Agent 商业化进展',
    '国产 AI 助手新动态',
    '大模型 API 价格变化',
  ],
}

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

function generateReport(categoryId: string, date: string): DailyReport {
  const seed = hash(`${categoryId}-${date}`)
  const pool = TOPIC_LIB[categoryId] ?? TOPIC_LIB.claudecode
  const hotspots = HOTSPOTS[categoryId] ?? HOTSPOTS.claudecode
  const topicCount = 3 + (seed % 3)  // 3-5
  const topics: TopicSuggestion[] = []
  for (let i = 0; i < topicCount; i++) {
    const t = pool[(seed + i) % pool.length]
    topics.push({
      id: `${categoryId}-${date}-t${i}`,
      title: t.title,
      brief: t.brief,
      tags: t.tags,
      relatedContentIds: [
        `${categoryId}-${date}-${i * 2}`,
        `${categoryId}-${date}-${i * 2 + 1}`,
        `${categoryId}-${date}-${i * 2 + 2}`,
      ],
    })
  }
  return {
    id: `${categoryId}-report-${date}`,
    categoryId,
    date,
    summary: topics[0].title,
    yesterdayHotspots: hotspots.slice(0, 3 + (seed % 2)),
    topics,
    analyzedContentIds: Array.from({ length: 10 }, (_, i) => `${categoryId}-${date}-${i}`),
  }
}

export const REPORTS_SEED: DailyReport[] = (() => {
  const days = pastNDays(7)
  const reports: DailyReport[] = []
  for (const cat of CATEGORIES_SEED) {
    for (const date of days) {
      reports.push(generateReport(cat.id, date))
    }
  }
  return reports
})()
```

- [ ] **Step 2: 写 categories 数据访问 + 测试**

Create `lib/data/categories.ts`:
```ts
import type { Category } from '@/lib/types'
import { CATEGORIES_SEED } from '@/lib/fixtures/categories'

// 注意：分类的运行时状态由 CategoriesProvider Context 持有。
// 此处的函数用于读取"初始"分类数据（例如 SSR 场景或无 Context 的上下文）。
// TODO(api): 将来改为 fetch('/api/categories')

export async function getInitialCategories(): Promise<Category[]> {
  return CATEGORIES_SEED
}

export async function getCategoryByIdFromSeed(id: string): Promise<Category | undefined> {
  return CATEGORIES_SEED.find((c) => c.id === id)
}
```

Create `tests/data/categories.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { getInitialCategories, getCategoryByIdFromSeed } from '@/lib/data/categories'

describe('categories data access', () => {
  it('getInitialCategories 返回预置分类', async () => {
    const categories = await getInitialCategories()
    expect(categories.length).toBeGreaterThanOrEqual(3)
    expect(categories.map((c) => c.id)).toContain('claudecode')
  })

  it('getCategoryByIdFromSeed 命中返回对应分类，未命中返回 undefined', async () => {
    const hit = await getCategoryByIdFromSeed('claudecode')
    expect(hit?.name).toBe('ClaudeCode 选题监控')
    const miss = await getCategoryByIdFromSeed('nonexistent')
    expect(miss).toBeUndefined()
  })
})
```

- [ ] **Step 3: 写 reports 访问函数的测试**

Create `tests/data/reports.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getReportList, getReportByDate, getTopicsByRange } from '@/lib/data/reports'

describe('reports data access', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-20T12:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('getReportList 返回该分类所有报告，按日期降序（最新在前）', async () => {
    const list = await getReportList('claudecode')
    expect(list.length).toBe(7)
    for (let i = 1; i < list.length; i++) {
      expect(list[i - 1].date >= list[i].date).toBe(true)
    }
    expect(list[0]).toHaveProperty('summary')
  })

  it('getReportByDate 命中返回完整报告，未命中返回 null', async () => {
    const hit = await getReportByDate('claudecode', '2026-04-19')
    expect(hit).not.toBeNull()
    expect(hit!.topics.length).toBeGreaterThanOrEqual(3)

    const miss = await getReportByDate('claudecode', '2020-01-01')
    expect(miss).toBeNull()
  })

  it('getTopicsByRange 返回近 N 天命中的选题，带 reportDate', async () => {
    const topics = await getTopicsByRange('claudecode', 7)
    expect(topics.length).toBeGreaterThan(0)
    expect(topics[0]).toHaveProperty('reportDate')
  })

  it('getTopicsByRange 可按 tags 筛选', async () => {
    const topics = await getTopicsByRange('claudecode', 7, ['MCP'])
    expect(topics.every((t) => t.tags.includes('MCP'))).toBe(true)
  })
})
```

- [ ] **Step 4: 运行测试验证失败**

Run: `npm test`
Expected: `reports.test.ts` 和 `categories.test.ts` 均 FAIL（reports.ts 未创建）。

- [ ] **Step 5: 实现 reports 数据访问**

Create `lib/data/reports.ts`:
```ts
import type { DailyReport, TopicSuggestion } from '@/lib/types'
import { REPORTS_SEED } from '@/lib/fixtures/reports'
import { pastNDays } from '@/lib/utils/dates'

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export async function getReportList(
  categoryId: string
): Promise<Array<Pick<DailyReport, 'id' | 'date' | 'summary'>>> {
  // TODO(api): GET /api/reports?categoryId=...
  await sleep(30)
  return REPORTS_SEED
    .filter((r) => r.categoryId === categoryId)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((r) => ({ id: r.id, date: r.date, summary: r.summary }))
}

export async function getReportByDate(
  categoryId: string,
  date: string
): Promise<DailyReport | null> {
  // TODO(api): GET /api/reports/:categoryId/:date
  await sleep(40)
  return REPORTS_SEED.find((r) => r.categoryId === categoryId && r.date === date) ?? null
}

export async function getTopicsByRange(
  categoryId: string,
  days: 7 | 30,
  tags?: string[]
): Promise<Array<TopicSuggestion & { reportDate: string }>> {
  // TODO(api): GET /api/topics?categoryId=...&days=...&tags=...
  await sleep(50)
  const dateSet = new Set(pastNDays(days))
  const result: Array<TopicSuggestion & { reportDate: string }> = []
  for (const r of REPORTS_SEED) {
    if (r.categoryId !== categoryId) continue
    if (!dateSet.has(r.date)) continue
    for (const t of r.topics) {
      if (tags && tags.length > 0 && !tags.some((tag) => t.tags.includes(tag))) continue
      result.push({ ...t, reportDate: r.date })
    }
  }
  return result.sort((a, b) => b.reportDate.localeCompare(a.reportDate))
}

export async function regenerateReport(_categoryId: string, _date: string): Promise<void> {
  // TODO(api): POST /api/reports/generate { categoryId, date }
  await sleep(2000)
}
```

- [ ] **Step 6: 运行所有测试验证通过**

Run: `npm test`
Expected: 全部测试 PASS（dates + categories + contents + reports）。

- [ ] **Step 7: Commit**

```bash
git add lib/fixtures/reports.ts lib/data/categories.ts lib/data/reports.ts tests/data/
git commit -m "data: reports + categories 访问函数（含 TDD 测试）与 regenerateReport 存根"
```

---

### Task 8: 根布局：全局 Provider + Sidebar + 主区骨架

**Files:**
- Modify: `app/layout.tsx`
- Create: `components/app-sidebar.tsx`, `components/create-category-dialog.tsx`

- [ ] **Step 1: 把 Provider 包进根布局**

Replace `app/layout.tsx`:
```tsx
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
```

- [ ] **Step 2: 创建 CreateCategoryDialog**

Create `components/create-category-dialog.tsx`:
```tsx
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
      <DialogTrigger asChild>
        <button className="w-full text-left px-3 py-2 text-sm text-neutral-500 border border-dashed border-neutral-300 rounded-md hover:bg-white hover:border-neutral-400 flex items-center gap-2">
          <Plus size={14} /> 新建分类
        </button>
      </DialogTrigger>
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
```

- [ ] **Step 3: 创建 AppSidebar**

Create `components/app-sidebar.tsx`:
```tsx
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
```

- [ ] **Step 4: 根路径重定向**

Replace `app/page.tsx`:
```tsx
import { redirect } from 'next/navigation'
import { CATEGORIES_SEED } from '@/lib/fixtures/categories'

export default function Home() {
  redirect(`/c/${CATEGORIES_SEED[0].id}/content`)
}
```

- [ ] **Step 5: 启动 dev 验证**

Run: `npm run dev`
Expected: `http://localhost:3000` 自动跳转到 `/c/claudecode/content`，页面 404（尚未实现），但左侧 sidebar 显示 3 个分类，点击"新建分类"弹窗可打开。Ctrl+C 退出。

- [ ] **Step 6: Commit**

```bash
git add app/layout.tsx app/page.tsx components/app-sidebar.tsx components/create-category-dialog.tsx
git commit -m "layout: Sidebar + Provider + 根重定向 + 新建分类弹窗"
```

---

### Task 9: 分类子路由布局：顶部 Tabs

**Files:**
- Create: `app/c/[categoryId]/layout.tsx`, `app/c/[categoryId]/page.tsx`, `components/tab-nav.tsx`

- [ ] **Step 1: 创建分类子布局**

Create `app/c/[categoryId]/layout.tsx`:
```tsx
import { notFound } from 'next/navigation'
import { CATEGORIES_SEED } from '@/lib/fixtures/categories'
import { TabNav } from '@/components/tab-nav'

export default async function CategoryLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ categoryId: string }>
}) {
  const { categoryId } = await params
  const cat = CATEGORIES_SEED.find((c) => c.id === categoryId)
  // 注意：新建的分类在 Context 里，不在 SEED 里 — 这里不做 notFound 兜底，交给页面处理
  return (
    <>
      <header className="h-14 px-6 flex items-center border-b border-neutral-200 bg-white sticky top-0 z-10">
        <div className="flex-1">
          <h1 className="text-base font-semibold">
            <CategoryName id={categoryId} fallback={cat?.name} />
          </h1>
        </div>
      </header>
      <TabNav categoryId={categoryId} />
      <div className="flex-1 overflow-auto">{children}</div>
    </>
  )
}

import { CategoryName } from '@/components/category-name'
```

- [ ] **Step 2: CategoryName 客户端组件（因需读 Context）**

Create `components/category-name.tsx`:
```tsx
'use client'

import { useCategories } from '@/components/categories-provider'

export function CategoryName({ id, fallback }: { id: string; fallback?: string }) {
  const { getById } = useCategories()
  const cat = getById(id)
  return <>{cat?.name ?? fallback ?? '未知分类'}</>
}
```

- [ ] **Step 3: 创建 TabNav**

Create `components/tab-nav.tsx`:
```tsx
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
```

- [ ] **Step 4: /c/[categoryId]/page.tsx 重定向到 content**

Create `app/c/[categoryId]/page.tsx`:
```tsx
import { redirect } from 'next/navigation'

export default async function CategoryIndex({
  params,
}: {
  params: Promise<{ categoryId: string }>
}) {
  const { categoryId } = await params
  redirect(`/c/${categoryId}/content`)
}
```

- [ ] **Step 5: Commit**

```bash
git add app/c/ components/tab-nav.tsx components/category-name.tsx
git commit -m "layout: 分类子路由 + 顶部 TabNav"
```

---

### Task 10: Tab 1 — 内容页基础 + 日期条

**Files:**
- Create: `app/c/[categoryId]/content/page.tsx`, `components/date-strip.tsx`

- [ ] **Step 1: 创建 DateStrip 组件**

Create `components/date-strip.tsx`:
```tsx
'use client'

import { cn } from '@/lib/utils'
import { formatDow, yesterday } from '@/lib/utils/dates'
import dayjs from 'dayjs'

type Bucket = { date: string; count: number }

export function DateStrip({
  buckets,
  value,
  onChange,
}: {
  buckets: Bucket[]
  value: string
  onChange: (date: string) => void
}) {
  const todayStr = dayjs().format('YYYY-MM-DD')
  const yesterdayStr = yesterday()

  return (
    <div className="flex gap-2 overflow-x-auto py-2 px-6 border-b border-neutral-200 bg-white">
      {buckets.map((b) => {
        const active = b.date === value
        const label =
          b.date === todayStr ? '今天' :
          b.date === yesterdayStr ? '昨天' :
          formatDow(b.date)
        const day = dayjs(b.date).date()
        const empty = b.count === 0

        return (
          <button
            key={b.date}
            onClick={() => onChange(b.date)}
            className={cn(
              'shrink-0 w-14 py-2 rounded-lg border flex flex-col items-center justify-center transition-colors',
              active
                ? 'bg-neutral-900 text-white border-neutral-900'
                : empty
                  ? 'bg-white text-neutral-400 border-neutral-200 hover:border-neutral-300'
                  : 'bg-white text-neutral-900 border-neutral-200 hover:border-neutral-400'
            )}
          >
            <span className={cn('text-[10px]', active ? 'text-white/70' : 'text-neutral-500')}>
              {label}
            </span>
            <span className="text-lg font-semibold leading-tight">{day}</span>
            {!empty && (
              <span className={cn(
                'text-[10px] px-1.5 rounded-full leading-4',
                active ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-600'
              )}>
                {b.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: 创建 content 页（仅日期条 + 占位）**

Create `app/c/[categoryId]/content/page.tsx`:
```tsx
'use client'

import { use, useEffect, useState } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { DateStrip } from '@/components/date-strip'
import { getDateBuckets } from '@/lib/data/contents'
import { yesterday } from '@/lib/utils/dates'

export default function ContentPage({
  params,
}: {
  params: Promise<{ categoryId: string }>
}) {
  const { categoryId } = use(params)
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams()
  const selectedDate = search.get('date') ?? yesterday()

  const [buckets, setBuckets] = useState<Array<{ date: string; count: number }>>([])

  useEffect(() => {
    getDateBuckets(categoryId, 14).then(setBuckets)
  }, [categoryId])

  function setDate(date: string) {
    const qs = new URLSearchParams(search.toString())
    qs.set('date', date)
    router.replace(`${pathname}?${qs.toString()}`)
  }

  return (
    <div className="flex flex-col">
      <DateStrip buckets={buckets} value={selectedDate} onChange={setDate} />
      <div className="p-6 text-sm text-neutral-500">
        已选日期：{selectedDate}（内容网格将在 Task 12 实现）
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 启动 dev 验证**

Run: `npm run dev`
Expected: 访问 `/c/claudecode/content`，显示日期卡片条（14 天，"昨天"默认选中并为黑底），每张卡片带数字徽标。点击其他日期 URL 变化并高亮切换。

- [ ] **Step 4: Commit**

```bash
git add app/c/[categoryId]/content/page.tsx components/date-strip.tsx
git commit -m "tab1: DateStrip 组件 + 内容页基础骨架"
```

---

### Task 11: Tab 1 — 平台筛选 Pills

**Files:**
- Create: `components/platform-filter.tsx`
- Modify: `app/c/[categoryId]/content/page.tsx`

- [ ] **Step 1: 创建 PlatformFilter 组件**

Create `components/platform-filter.tsx`:
```tsx
'use client'

import { cn } from '@/lib/utils'
import { PLATFORMS, type Platform } from '@/lib/types'

export function PlatformFilter({
  counts,
  selected,
  onChange,
}: {
  counts: Record<Platform, number>
  selected: Platform[]
  onChange: (next: Platform[]) => void
}) {
  const total = PLATFORMS.reduce((s, p) => s + (counts[p.id] ?? 0), 0)
  const allSelected = selected.length === 0

  function togglePlatform(p: Platform) {
    if (allSelected) {
      onChange([p])
    } else if (selected.includes(p)) {
      const next = selected.filter((s) => s !== p)
      onChange(next.length === 0 ? [] : next)
    } else {
      onChange([...selected, p])
    }
  }

  return (
    <div className="flex flex-wrap gap-2 py-3 px-6 border-b border-neutral-200 bg-white">
      <button
        onClick={() => onChange([])}
        className={cn(
          'px-3 py-1 text-xs rounded-full border transition-colors',
          allSelected
            ? 'bg-neutral-900 text-white border-neutral-900'
            : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-400'
        )}
      >
        全部 ({total})
      </button>
      {PLATFORMS.map((p) => {
        const isSelected = selected.includes(p.id)
        const count = counts[p.id] ?? 0
        return (
          <button
            key={p.id}
            onClick={() => togglePlatform(p.id)}
            className={cn(
              'px-3 py-1 text-xs rounded-full border transition-colors',
              isSelected
                ? 'bg-neutral-900 text-white border-neutral-900'
                : count === 0
                  ? 'bg-neutral-50 text-neutral-400 border-neutral-200'
                  : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-400'
            )}
          >
            {p.name} ({count})
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: 接入 content 页**

Replace `app/c/[categoryId]/content/page.tsx`:
```tsx
'use client'

import { use, useEffect, useState } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { DateStrip } from '@/components/date-strip'
import { PlatformFilter } from '@/components/platform-filter'
import { getDateBuckets, getPlatformCounts } from '@/lib/data/contents'
import { yesterday } from '@/lib/utils/dates'
import type { Platform } from '@/lib/types'

export default function ContentPage({
  params,
}: {
  params: Promise<{ categoryId: string }>
}) {
  const { categoryId } = use(params)
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams()
  const selectedDate = search.get('date') ?? yesterday()
  const platformsParam = search.get('platforms')
  const selectedPlatforms: Platform[] = platformsParam
    ? (platformsParam.split(',').filter(Boolean) as Platform[])
    : []

  const [buckets, setBuckets] = useState<Array<{ date: string; count: number }>>([])
  const [platformCounts, setPlatformCounts] = useState<Record<Platform, number>>({
    douyin: 0, xiaohongshu: 0, weibo: 0, bilibili: 0,
  })

  useEffect(() => {
    getDateBuckets(categoryId, 14).then(setBuckets)
  }, [categoryId])

  useEffect(() => {
    getPlatformCounts(categoryId, selectedDate).then(setPlatformCounts)
  }, [categoryId, selectedDate])

  function updateParam(key: string, value: string | null) {
    const qs = new URLSearchParams(search.toString())
    if (value === null || value === '') qs.delete(key)
    else qs.set(key, value)
    router.replace(`${pathname}${qs.toString() ? `?${qs}` : ''}`)
  }

  return (
    <div className="flex flex-col">
      <DateStrip
        buckets={buckets}
        value={selectedDate}
        onChange={(d) => updateParam('date', d)}
      />
      <PlatformFilter
        counts={platformCounts}
        selected={selectedPlatforms}
        onChange={(ps) => updateParam('platforms', ps.length === 0 ? null : ps.join(','))}
      />
      <div className="p-6 text-sm text-neutral-500">
        {selectedDate} · 平台：{selectedPlatforms.length === 0 ? '全部' : selectedPlatforms.join(', ')}（网格将在 Task 12 实现）
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 验证**

Run: `npm run dev`
Expected: 可切换日期 / 多选平台，URL search params 同步；平台 Pills 的计数随日期变化。

- [ ] **Step 4: Commit**

```bash
git add components/platform-filter.tsx app/c/[categoryId]/content/page.tsx
git commit -m "tab1: 平台筛选 Pills + URL 参数双向绑定"
```

---

### Task 12: Tab 1 — 内容卡片网格

**Files:**
- Create: `components/content-card.tsx`, `components/content-grid.tsx`
- Modify: `app/c/[categoryId]/content/page.tsx`

- [ ] **Step 1: 创建 ContentCard**

Create `components/content-card.tsx`:
```tsx
'use client'

import Image from 'next/image'
import { Heart, MessageCircle, Share2, ExternalLink } from 'lucide-react'
import { PLATFORMS, type ContentItem } from '@/lib/types'
import { cn } from '@/lib/utils'
import dayjs from 'dayjs'

function fmtNum(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return `${n}`
}

export function ContentCard({ item, compact = false }: { item: ContentItem; compact?: boolean }) {
  const platform = PLATFORMS.find((p) => p.id === item.platform)

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'group bg-white border border-neutral-200 rounded-lg overflow-hidden hover:shadow-md hover:border-neutral-300 transition-all flex flex-col',
        compact && 'flex-row'
      )}
    >
      <div className={cn('relative bg-neutral-100 shrink-0', compact ? 'w-32 aspect-video' : 'aspect-video')}>
        {item.coverImage ? (
          <Image
            src={item.coverImage}
            alt=""
            fill
            sizes="(max-width: 1280px) 50vw, 33vw"
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-neutral-400 text-xs">
            {platform?.name}
          </div>
        )}
        <span
          className="absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded-full text-white font-medium"
          style={{ backgroundColor: platform?.color }}
        >
          {platform?.name}
        </span>
      </div>
      <div className="p-3 flex flex-col gap-2 flex-1 min-w-0">
        <h3 className={cn('font-medium line-clamp-2 text-neutral-900', compact ? 'text-xs' : 'text-sm')}>
          {item.title}
        </h3>
        <div className="text-[11px] text-neutral-500 flex items-center gap-1 truncate">
          <span className="truncate">@{item.author}</span>
          <span>·</span>
          <span>{dayjs(item.publishedAt).format('HH:mm')}</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-neutral-500">
          <span className="flex items-center gap-1"><Heart size={11} />{fmtNum(item.stats.likes)}</span>
          <span className="flex items-center gap-1"><MessageCircle size={11} />{fmtNum(item.stats.comments)}</span>
          <span className="flex items-center gap-1"><Share2 size={11} />{fmtNum(item.stats.shares)}</span>
          <ExternalLink size={11} className="ml-auto opacity-0 group-hover:opacity-60" />
        </div>
        <div className="text-[10px] text-neutral-400 truncate">
          对标{item.matchedBy.type === 'keyword' ? '关键词' : '博主'}：{item.matchedBy.value}
        </div>
      </div>
    </a>
  )
}
```

- [ ] **Step 2: 创建 ContentGrid**

Create `components/content-grid.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { ContentCard } from '@/components/content-card'
import type { ContentItem } from '@/lib/types'
import dayjs from 'dayjs'
import { Inbox } from 'lucide-react'

type SortBy = 'hot' | 'time'

export function ContentGrid({ items }: { items: ContentItem[] }) {
  const [sortBy, setSortBy] = useState<SortBy>('hot')

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-neutral-400">
        <Inbox size={48} className="mb-3" />
        <div className="text-sm">该日尚未采集到内容</div>
      </div>
    )
  }

  const sorted = sortBy === 'hot'
    ? [...items].sort((a, b) => b.hotScore - a.hotScore)
    : [...items].sort((a, b) => dayjs(b.publishedAt).unix() - dayjs(a.publishedAt).unix())

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-neutral-500">共 {items.length} 条</div>
        <div className="flex gap-1 bg-neutral-100 p-0.5 rounded-md text-xs">
          <button
            onClick={() => setSortBy('hot')}
            className={`px-2.5 py-1 rounded ${sortBy === 'hot' ? 'bg-white shadow-sm' : 'text-neutral-500'}`}
          >按热度</button>
          <button
            onClick={() => setSortBy('time')}
            className={`px-2.5 py-1 rounded ${sortBy === 'time' ? 'bg-white shadow-sm' : 'text-neutral-500'}`}
          >按时间</button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {sorted.map((item) => (
          <ContentCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 接入 content 页**

Modify `app/c/[categoryId]/content/page.tsx` — 在文件顶部添加 `import { getContentsByDate } from '@/lib/data/contents'` 与 `import { ContentGrid } from '@/components/content-grid'`，添加 state + effect 取 items，并把底部"网格将在 Task 12 实现"替换为 `<ContentGrid items={items} />`。完整替换：
```tsx
'use client'

import { use, useEffect, useState } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { DateStrip } from '@/components/date-strip'
import { PlatformFilter } from '@/components/platform-filter'
import { ContentGrid } from '@/components/content-grid'
import { getContentsByDate, getDateBuckets, getPlatformCounts } from '@/lib/data/contents'
import { yesterday } from '@/lib/utils/dates'
import type { ContentItem, Platform } from '@/lib/types'

export default function ContentPage({
  params,
}: {
  params: Promise<{ categoryId: string }>
}) {
  const { categoryId } = use(params)
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams()
  const selectedDate = search.get('date') ?? yesterday()
  const platformsParam = search.get('platforms')
  const selectedPlatforms: Platform[] = platformsParam
    ? (platformsParam.split(',').filter(Boolean) as Platform[])
    : []

  const [buckets, setBuckets] = useState<Array<{ date: string; count: number }>>([])
  const [platformCounts, setPlatformCounts] = useState<Record<Platform, number>>({
    douyin: 0, xiaohongshu: 0, weibo: 0, bilibili: 0,
  })
  const [items, setItems] = useState<ContentItem[]>([])

  useEffect(() => {
    getDateBuckets(categoryId, 14).then(setBuckets)
  }, [categoryId])

  useEffect(() => {
    getPlatformCounts(categoryId, selectedDate).then(setPlatformCounts)
  }, [categoryId, selectedDate])

  useEffect(() => {
    getContentsByDate(categoryId, selectedDate, selectedPlatforms).then(setItems)
  }, [categoryId, selectedDate, platformsParam])

  function updateParam(key: string, value: string | null) {
    const qs = new URLSearchParams(search.toString())
    if (value === null || value === '') qs.delete(key)
    else qs.set(key, value)
    router.replace(`${pathname}${qs.toString() ? `?${qs}` : ''}`)
  }

  return (
    <div className="flex flex-col">
      <DateStrip buckets={buckets} value={selectedDate} onChange={(d) => updateParam('date', d)} />
      <PlatformFilter
        counts={platformCounts}
        selected={selectedPlatforms}
        onChange={(ps) => updateParam('platforms', ps.length === 0 ? null : ps.join(','))}
      />
      <ContentGrid items={items} />
    </div>
  )
}
```

- [ ] **Step 4: 验证**

Run: `npm run dev`
Expected: `/c/claudecode/content` 显示 15-25 张内容卡片，含封面（picsum）、平台色标、点赞/评论/转发数。切换日期/平台内容同步刷新。选空日期或筛选组合显示空状态插画。

- [ ] **Step 5: Commit**

```bash
git add components/content-card.tsx components/content-grid.tsx app/c/[categoryId]/content/page.tsx
git commit -m "tab1: 内容卡片网格 + 排序切换 + 空状态"
```

---

### Task 13: Tab 2 — 报告路由 + 视图切换 + 左栏

**Files:**
- Create: `app/c/[categoryId]/reports/page.tsx`, `components/report-list.tsx`

- [ ] **Step 1: 创建 ReportList**

Create `components/report-list.tsx`:
```tsx
'use client'

import { cn } from '@/lib/utils'
import { formatDow } from '@/lib/utils/dates'
import dayjs from 'dayjs'

type Item = { id: string; date: string; summary: string }

export function ReportList({
  items,
  selectedDate,
  onSelect,
}: {
  items: Item[]
  selectedDate: string
  onSelect: (date: string) => void
}) {
  if (items.length === 0) {
    return <div className="p-4 text-xs text-neutral-400">暂无历史报告</div>
  }
  return (
    <div className="p-2 space-y-1">
      {items.map((r, idx) => {
        const active = r.date === selectedDate
        return (
          <button
            key={r.id}
            onClick={() => onSelect(r.date)}
            className={cn(
              'w-full text-left p-3 rounded-md border transition-colors',
              active
                ? 'bg-white border-neutral-300 shadow-sm'
                : 'bg-transparent border-transparent hover:bg-white/60'
            )}
          >
            <div className="flex items-center justify-between mb-1 text-[11px]">
              <span className="text-neutral-600">
                {dayjs(r.date).format('M月D日')} · {formatDow(r.date)}
              </span>
              {idx === 0 && (
                <span className="bg-indigo-50 text-indigo-600 px-1.5 rounded text-[9px]">最新</span>
              )}
            </div>
            <div className="text-[11px] text-neutral-700 line-clamp-2 leading-relaxed">
              {r.summary}
            </div>
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: 创建 reports 页（含视图切换 + 左栏，右主区先占位）**

Create `app/c/[categoryId]/reports/page.tsx`:
```tsx
'use client'

import { use, useEffect, useState } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { ReportList } from '@/components/report-list'
import { getReportList } from '@/lib/data/reports'

type View = 'by-date' | 'by-topic'

export default function ReportsPage({
  params,
}: {
  params: Promise<{ categoryId: string }>
}) {
  const { categoryId } = use(params)
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams()
  const view = (search.get('view') as View) ?? 'by-date'
  const selectedDate = search.get('date')

  const [list, setList] = useState<Array<{ id: string; date: string; summary: string }>>([])

  useEffect(() => {
    getReportList(categoryId).then((items) => {
      setList(items)
      if (!selectedDate && items[0]) {
        updateParam('date', items[0].date)
      }
    })
  }, [categoryId])

  function updateParam(key: string, value: string | null) {
    const qs = new URLSearchParams(search.toString())
    if (value === null) qs.delete(key)
    else qs.set(key, value)
    router.replace(`${pathname}${qs.toString() ? `?${qs}` : ''}`)
  }

  const currentDate = selectedDate ?? list[0]?.date ?? ''

  return (
    <div className="flex flex-col">
      <div className="px-6 py-3 border-b border-neutral-200 bg-white">
        <ToggleGroup
          type="single"
          value={view}
          onValueChange={(v) => v && updateParam('view', v)}
          className="inline-flex"
        >
          <ToggleGroupItem value="by-date" className="text-xs">按日期</ToggleGroupItem>
          <ToggleGroupItem value="by-topic" className="text-xs">按选题</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {view === 'by-date' ? (
        <div className="flex min-h-[calc(100vh-14rem)]">
          <aside className="w-72 shrink-0 bg-neutral-50 border-r border-neutral-200 overflow-y-auto">
            <ReportList
              items={list}
              selectedDate={currentDate}
              onSelect={(d) => updateParam('date', d)}
            />
          </aside>
          <section className="flex-1 min-w-0">
            <div className="p-6 text-sm text-neutral-500">
              已选报告：{currentDate}（阅读区将在 Task 14 实现）
            </div>
          </section>
        </div>
      ) : (
        <div className="p-6 text-sm text-neutral-500">（按选题聚合视图将在 Task 16 实现）</div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: 验证**

Run: `npm run dev`
Expected: `/c/claudecode/reports` 进入页面后自动补全 `?view=by-date&date=<最新>`；左栏显示 7 条报告预览，点击切换 URL；右主占位；点击"按选题"切换到占位提示。

- [ ] **Step 4: Commit**

```bash
git add app/c/[categoryId]/reports/page.tsx components/report-list.tsx
git commit -m "tab2: 报告路由 + 视图切换 + 左栏索引"
```

---

### Task 14: Tab 2 — 选题卡片 + 报告阅读区

**Files:**
- Create: `components/topic-card.tsx`, `components/report-viewer.tsx`
- Modify: `app/c/[categoryId]/reports/page.tsx`

- [ ] **Step 1: 创建 TopicCard**

Create `components/topic-card.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, Sparkles, TrendingUp, Lightbulb } from 'lucide-react'
import type { TopicSuggestion } from '@/lib/types'

export function TopicCard({
  topic,
  reportDate,
  onJumpToReport,
}: {
  topic: TopicSuggestion
  reportDate?: string
  onJumpToReport?: (date: string) => void
}) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="text-base font-semibold text-neutral-900 leading-tight">{topic.title}</h3>
        {reportDate && onJumpToReport && (
          <button
            onClick={() => onJumpToReport(reportDate)}
            className="shrink-0 text-[11px] text-neutral-500 hover:text-neutral-900"
          >
            来自 {reportDate} ↗
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {topic.tags.map((t) => (
          <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
        ))}
      </div>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1 text-xs text-neutral-500 mb-2"
      >
        <ChevronDown size={14} className={cn('transition-transform', !expanded && '-rotate-90')} />
        {expanded ? '收起详情' : '展开详情'}
      </button>
      {expanded && (
        <dl className="space-y-3 text-sm">
          <BriefRow icon={<Lightbulb size={14} />} label="为什么做" text={topic.brief.why} />
          <BriefRow icon={<Sparkles size={14} />} label="爆点在哪" text={topic.brief.hook} />
          <BriefRow icon={<TrendingUp size={14} />} label="增长空间" text={topic.brief.growth} />
        </dl>
      )}
    </div>
  )
}

function BriefRow({ icon, label, text }: { icon: React.ReactNode; label: string; text: string }) {
  return (
    <div className="flex gap-3">
      <div className="shrink-0 w-20 text-xs text-neutral-500 flex items-center gap-1.5 pt-0.5">
        {icon}{label}
      </div>
      <div className="flex-1 text-neutral-700 leading-relaxed text-[13px]">{text}</div>
    </div>
  )
}
```

- [ ] **Step 2: 创建 ReportViewer**

Create `components/report-viewer.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { TopicCard } from '@/components/topic-card'
import { regenerateReport } from '@/lib/data/reports'
import { formatDow } from '@/lib/utils/dates'
import { RefreshCw, Flame } from 'lucide-react'
import { toast } from 'sonner'
import dayjs from 'dayjs'
import type { DailyReport } from '@/lib/types'

export function ReportViewer({ report }: { report: DailyReport | null }) {
  const [regenerating, setRegenerating] = useState(false)

  if (!report) {
    return <div className="p-10 text-sm text-neutral-400">该日尚未生成报告</div>
  }

  async function handleRegenerate() {
    if (!report) return
    setRegenerating(true)
    // TODO(api): POST /api/reports/generate
    await regenerateReport(report.categoryId, report.date)
    setRegenerating(false)
    toast.success('AI 分析完成（原型演示）')
  }

  return (
    <article className="p-6 max-w-4xl space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold mb-1">
            {dayjs(report.date).format('M月D日')} · {formatDow(report.date)} 选题分析报告
          </h2>
          <p className="text-xs text-neutral-500">
            覆盖 4 个平台 · 分析 Top {report.analyzedContentIds.length} 热门内容 · {report.topics.length} 个核心选题
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={handleRegenerate} disabled={regenerating}>
          <RefreshCw size={14} className={regenerating ? 'animate-spin' : ''} />
          {regenerating ? '分析中...' : '重新生成'}
        </Button>
      </header>

      <section>
        <div className="flex items-center gap-2 text-sm font-medium mb-3">
          <Flame size={14} className="text-orange-500" />
          前一天热点
        </div>
        <div className="flex flex-wrap gap-2">
          {report.yesterdayHotspots.map((h) => (
            <Badge key={h} variant="outline" className="text-[11px] py-1 px-2">{h}</Badge>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-medium mb-3">选题建议</h3>
        <div className="space-y-3">
          {report.topics.map((t) => (
            <TopicCard key={t.id} topic={t} />
          ))}
        </div>
      </section>
    </article>
  )
}
```

- [ ] **Step 3: 接入 reports 页**

Modify `app/c/[categoryId]/reports/page.tsx` — 在顶部 import：
```tsx
import { ReportViewer } from '@/components/report-viewer'
import { getReportByDate } from '@/lib/data/reports'
import type { DailyReport } from '@/lib/types'
```
添加 state：
```tsx
const [report, setReport] = useState<DailyReport | null>(null)
```
添加 effect：
```tsx
useEffect(() => {
  if (!currentDate) return
  getReportByDate(categoryId, currentDate).then(setReport)
}, [categoryId, currentDate])
```
把右主区占位替换为：
```tsx
<section className="flex-1 min-w-0 overflow-y-auto bg-white">
  <ReportViewer report={report} />
</section>
```

- [ ] **Step 4: 验证**

Run: `npm run dev`
Expected: `/c/claudecode/reports` 右主区显示报告元信息、"前一天热点" Pills、3-5 个选题卡片（每卡片三段 brief 可折叠）。点击"重新生成"按钮转圈 2 秒后 toast 提示。切换左栏日期，右主区内容同步刷新。

- [ ] **Step 5: Commit**

```bash
git add components/topic-card.tsx components/report-viewer.tsx app/c/[categoryId]/reports/page.tsx
git commit -m "tab2: 报告阅读区（选题卡片 + 热点标签 + 重新生成按钮）"
```

---

### Task 15: Tab 2 — "按选题"聚合视图

**Files:**
- Create: `components/topics-aggregate-view.tsx`
- Modify: `app/c/[categoryId]/reports/page.tsx`

- [ ] **Step 1: 创建 TopicsAggregateView**

Create `components/topics-aggregate-view.tsx`:
```tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { TopicCard } from '@/components/topic-card'
import { Badge } from '@/components/ui/badge'
import { getTopicsByRange } from '@/lib/data/reports'
import { cn } from '@/lib/utils'
import type { TopicSuggestion } from '@/lib/types'

type Range = 7 | 30
type Topic = TopicSuggestion & { reportDate: string }

export function TopicsAggregateView({
  categoryId,
  onJumpToReport,
}: {
  categoryId: string
  onJumpToReport: (date: string) => void
}) {
  const [range, setRange] = useState<Range>(7)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [topics, setTopics] = useState<Topic[]>([])

  useEffect(() => {
    getTopicsByRange(categoryId, range, selectedTags.length ? selectedTags : undefined)
      .then(setTopics)
  }, [categoryId, range, selectedTags.join(',')])

  // 先无筛选取一轮，算出所有可选 tag
  const [allTopics, setAllTopics] = useState<Topic[]>([])
  useEffect(() => {
    getTopicsByRange(categoryId, range).then(setAllTopics)
  }, [categoryId, range])

  const availableTags = useMemo(() => {
    const set = new Set<string>()
    allTopics.forEach((t) => t.tags.forEach((tag) => set.add(tag)))
    return Array.from(set).sort()
  }, [allTopics])

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-6 flex-wrap">
        <div className="flex gap-1 bg-neutral-100 p-0.5 rounded-md text-xs">
          {([7, 30] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                'px-3 py-1 rounded',
                range === r ? 'bg-white shadow-sm font-medium' : 'text-neutral-500'
              )}
            >近 {r} 天</button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-neutral-500 shrink-0">标签：</span>
          {availableTags.map((tag) => {
            const active = selectedTags.includes(tag)
            return (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={cn(
                  'text-[10px] px-2 py-0.5 rounded-full border transition-colors',
                  active
                    ? 'bg-neutral-900 text-white border-neutral-900'
                    : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'
                )}
              >{tag}</button>
            )
          })}
          {selectedTags.length > 0 && (
            <button
              onClick={() => setSelectedTags([])}
              className="text-[10px] text-neutral-500 hover:text-neutral-900"
            >清空</button>
          )}
        </div>
      </div>

      <div className="text-xs text-neutral-500">命中 {topics.length} 个选题</div>

      {topics.length === 0 ? (
        <div className="py-12 text-center text-sm text-neutral-400">
          调整筛选条件或等待更多报告生成
        </div>
      ) : (
        <div className="space-y-3">
          {topics.map((t) => (
            <TopicCard
              key={`${t.reportDate}-${t.id}`}
              topic={t}
              reportDate={t.reportDate}
              onJumpToReport={onJumpToReport}
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 接入 reports 页**

Modify `app/c/[categoryId]/reports/page.tsx` — import：
```tsx
import { TopicsAggregateView } from '@/components/topics-aggregate-view'
```
在 `view === 'by-topic'` 分支替换占位：
```tsx
<TopicsAggregateView
  categoryId={categoryId}
  onJumpToReport={(d) => {
    const qs = new URLSearchParams()
    qs.set('view', 'by-date')
    qs.set('date', d)
    router.replace(`${pathname}?${qs.toString()}`)
  }}
/>
```

- [ ] **Step 3: 验证**

Run: `npm run dev`
Expected: 切换到"按选题"视图，显示近 7 天聚合选题列表，顶部可切换 7/30 天、按 tag 多选筛选。每张卡片显示"来自 X 月 X 日"可点击跳回"按日期"视图并定位对应报告。

- [ ] **Step 4: Commit**

```bash
git add components/topics-aggregate-view.tsx app/c/[categoryId]/reports/page.tsx
git commit -m "tab2: 按选题聚合视图（时间范围 + 标签筛选 + 跳回报告）"
```

---

### Task 16: Tab 3 — 监控设置表单

**Files:**
- Create: `app/c/[categoryId]/settings/page.tsx`, `components/settings-form.tsx`, `components/add-account-dialog.tsx`

- [ ] **Step 1: 创建 AddAccountDialog**

Create `components/add-account-dialog.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PLATFORMS, type Platform } from '@/lib/types'
import { UserPlus } from 'lucide-react'

export function AddAccountDialog({
  onAdd,
}: {
  onAdd: (a: { platform: Platform; handle: string; displayName: string }) => void
}) {
  const [open, setOpen] = useState(false)
  const [platform, setPlatform] = useState<Platform>('bilibili')
  const [handle, setHandle] = useState('')
  const [displayName, setDisplayName] = useState('')

  function submit() {
    if (!handle.trim() || !displayName.trim()) return
    onAdd({ platform, handle: handle.trim(), displayName: displayName.trim() })
    setOpen(false)
    setHandle('')
    setDisplayName('')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserPlus size={14} /> 新增博主
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新增对标博主</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>平台</Label>
            <div className="flex gap-2 flex-wrap">
              {PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPlatform(p.id)}
                  className={`px-3 py-1 text-xs rounded-full border ${platform === p.id ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white border-neutral-200'}`}
                >{p.name}</button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="handle">账号 ID / Handle</Label>
            <Input id="handle" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="如 @ai_daily" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dn">显示名称</Label>
            <Input id="dn" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="如 AI 日报君" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>取消</Button>
          <Button onClick={submit} disabled={!handle.trim() || !displayName.trim()}>添加</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: 创建 SettingsForm**

Create `components/settings-form.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { AddAccountDialog } from '@/components/add-account-dialog'
import { PLATFORMS, type MonitorSettings, type Platform } from '@/lib/types'
import { useCategories } from '@/components/categories-provider'
import { Info, X, Pause, Play, Trash2, Clock } from 'lucide-react'
import { toast } from 'sonner'

export function SettingsForm({ categoryId }: { categoryId: string }) {
  const { getById, updateSettings } = useCategories()
  const cat = getById(categoryId)
  const [settings, setSettings] = useState<MonitorSettings>(
    cat?.settings ?? { platforms: [], keywords: [], accounts: [] }
  )
  const [keywordInput, setKeywordInput] = useState('')
  const [pausedAccounts, setPausedAccounts] = useState<Set<string>>(new Set())

  if (!cat) {
    return <div className="p-6 text-sm text-neutral-500">分类不存在</div>
  }

  function togglePlatform(p: Platform) {
    setSettings((s) => ({
      ...s,
      platforms: s.platforms.includes(p)
        ? s.platforms.filter((x) => x !== p)
        : [...s.platforms, p],
    }))
  }

  function addKeyword() {
    const v = keywordInput.trim()
    if (!v || settings.keywords.includes(v)) return
    setSettings((s) => ({ ...s, keywords: [...s.keywords, v] }))
    setKeywordInput('')
  }

  function removeKeyword(k: string) {
    setSettings((s) => ({ ...s, keywords: s.keywords.filter((x) => x !== k) }))
  }

  function addAccount(a: { platform: Platform; handle: string; displayName: string }) {
    setSettings((s) => ({ ...s, accounts: [...s.accounts, a] }))
  }

  function removeAccount(handle: string, platform: Platform) {
    setSettings((s) => ({
      ...s,
      accounts: s.accounts.filter((a) => !(a.handle === handle && a.platform === platform)),
    }))
  }

  function togglePause(handle: string, platform: Platform) {
    const key = `${platform}-${handle}`
    setPausedAccounts((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function save() {
    if (settings.platforms.length === 0) {
      toast.error('至少启用一个平台')
      return
    }
    // TODO(api): PUT /api/categories/:id/settings
    await new Promise((r) => setTimeout(r, 300))
    updateSettings(categoryId, settings)
    toast.success('设置已保存（原型演示）')
  }

  return (
    <div className="max-w-3xl p-6 space-y-6 pb-24">
      <div className="bg-blue-50 border border-blue-100 rounded-md p-3 flex items-start gap-2 text-xs text-blue-900">
        <Clock size={14} className="shrink-0 mt-0.5" />
        <div>该分类将于每天 08:00 自动运行采集任务。当前为原型演示，不会真实采集。</div>
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-medium">监控平台</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {PLATFORMS.map((p) => {
            const enabled = settings.platforms.includes(p.id)
            return (
              <div
                key={p.id}
                className={`p-3 border rounded-md flex items-center justify-between ${enabled ? 'bg-white border-neutral-300' : 'bg-neutral-50 border-neutral-200'}`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                  <span className="text-sm">{p.name}</span>
                </div>
                <Switch checked={enabled} onCheckedChange={() => togglePlatform(p.id)} />
              </div>
            )
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium">对标关键词</h3>
        <div className="flex gap-2">
          <Input
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
            placeholder="输入关键词按回车添加"
          />
          <Button onClick={addKeyword} variant="outline">添加</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {settings.keywords.map((k) => (
            <span key={k} className="bg-white border border-neutral-200 rounded-full px-3 py-1 text-xs flex items-center gap-1.5">
              {k}
              <button onClick={() => removeKeyword(k)} className="text-neutral-400 hover:text-neutral-900">
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
        <div className="text-xs text-neutral-500">共 {settings.keywords.length} 个关键词</div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">对标博主 / 账号</h3>
          <AddAccountDialog onAdd={addAccount} />
        </div>
        <div className="space-y-2">
          {settings.accounts.length === 0 && (
            <div className="text-xs text-neutral-400 py-4 text-center border border-dashed rounded-md">
              暂无对标博主
            </div>
          )}
          {settings.accounts.map((a) => {
            const platform = PLATFORMS.find((p) => p.id === a.platform)!
            const key = `${a.platform}-${a.handle}`
            const paused = pausedAccounts.has(key)
            return (
              <div key={key} className={`flex items-center justify-between p-3 bg-white border border-neutral-200 rounded-md ${paused ? 'opacity-50' : ''}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: platform.color }} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{a.displayName}</div>
                    <div className="text-[11px] text-neutral-500 truncate">{platform.name} · @{a.handle}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => togglePause(a.handle, a.platform)}>
                    {paused ? <Play size={14} /> : <Pause size={14} />}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => removeAccount(a.handle, a.platform)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <div className="fixed bottom-0 left-60 right-0 border-t border-neutral-200 bg-white p-3 flex justify-end gap-2">
        <Button variant="ghost" onClick={() => setSettings(cat.settings)}>重置</Button>
        <Button onClick={save}>保存设置</Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 创建 settings 页**

Create `app/c/[categoryId]/settings/page.tsx`:
```tsx
'use client'

import { use } from 'react'
import { SettingsForm } from '@/components/settings-form'

export default function SettingsPage({
  params,
}: {
  params: Promise<{ categoryId: string }>
}) {
  const { categoryId } = use(params)
  return <SettingsForm categoryId={categoryId} />
}
```

- [ ] **Step 4: 验证**

Run: `npm run dev`
Expected: `/c/claudecode/settings` 显示顶部蓝色信息条、4 个平台开关卡片、关键词 Tag 输入（回车添加、点 × 删除）、博主列表（+ 新增对话框可用、可暂停/删除）。点击"保存设置"转圈后 toast 成功。

- [ ] **Step 5: Commit**

```bash
git add app/c/[categoryId]/settings/page.tsx components/settings-form.tsx components/add-account-dialog.tsx
git commit -m "tab3: 监控设置表单（平台/关键词/博主 + 保存交互）"
```

---

### Task 17: README + 最终端到端验证

**Files:**
- Create: `README.md`

- [ ] **Step 1: 写 README**

Create `README.md`:
```markdown
# 内容工厂 · 前端原型

按分类管理内容监控任务的 Next.js 前端原型。所有数据为内置假数据，无后端。

## 快速开始

```bash
npm install
npm run dev
```

访问 http://localhost:3000

## 功能

- **分类侧栏**：管理多个监控分类，支持新建
- **Tab 1 · 内容**：日期卡片 + 平台筛选 + 内容卡片网格（14 天假数据）
- **Tab 2 · 选题分析**：按日期查看每日 AI 报告，按选题聚合查看近 7/30 天选题
- **Tab 3 · 监控设置**：平台开关 / 关键词 Tag / 对标博主管理

## 测试

```bash
npm test          # 运行 data / utils 层单元测试
npm run test:watch
```

## 将来接入真实后端

所有取数走 `lib/data/*.ts` 的 async 函数。搜索 `TODO(api):` 定位需要改为真实 API 调用的位置。详见 `docs/superpowers/specs/2026-04-20-content-monitor-prototype-design.md` 的"将来接入真实后端的迁移路径"。

## 目录结构

- `app/` — 路由页面
- `components/` — 业务组件 + shadcn/ui
- `lib/data/` — 数据访问层（当前读 fixtures）
- `lib/fixtures/` — 假数据
- `lib/types.ts` — 核心类型
- `tests/` — Vitest 单元测试
```

- [ ] **Step 2: 跑全部测试**

Run: `npm test`
Expected: 所有 dates / categories / contents / reports 测试通过。

- [ ] **Step 3: 构建验证无错**

Run: `npm run build`
Expected: Build succeeds. 若有 TS 错误，在此修复。

- [ ] **Step 4: 端到端人工验证清单**

Run: `npm run dev`，依次验证：

1. 打开 `/` → 自动跳转到 `/c/claudecode/content`
2. 左侧 sidebar 3 个分类可切换；点击"+ 新建分类"输入名字 → 跳到新分类 content 页、sidebar 出现新分类
3. Tab 1：日期卡片 14 天、"昨天"默认选中黑底；切换日期 URL 变化、内容刷新；平台 Pills 多选可用；排序切换可用；封面图加载（picsum）
4. 切换到"AI 产品监控"分类 → 各 Tab 内容应不同
5. Tab 2（按日期）：左栏 7 条报告（最新标红），点击切换右主；"重新生成"转圈 2s 后 toast；选题卡片三段 brief 可折叠
6. Tab 2（按选题）：切换视图后顶部有 7/30 天切换 + 标签多选；命中选题卡片列表；点"来自 X 月 X 日 ↗" 跳回按日期视图并定位
7. Tab 3：平台开关 / 关键词 Tag 输入回车 + × 删除 / 新增博主对话框可用；关掉所有平台后"保存"报错；保存成功 toast
8. 浏览器后退前进正常工作

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: README 说明与本地启动指南"
```

---

## Self-Review

检查 spec 与 plan 的覆盖关系（已在起草后核对）：

- ✅ **分类管理（顶层）** — Task 5 + 8 实现 CategoriesProvider 与 Sidebar 含新建对话框
- ✅ **三个 Tab 结构** — Task 9 TabNav 覆盖
- ✅ **Tab 1 平台筛选（平铺 Pills、多选、带计数）** — Task 11
- ✅ **Tab 1 日期卡片横向滚动（默认"昨天"、带数量徽标、过去 14 天）** — Task 10
- ✅ **Tab 1 内容卡片（封面 / 平台 / 标题 / 作者 / 三指标 / 对标来源 / 跳外链）+ 排序切换 + 空状态** — Task 12
- ✅ **Tab 2 视图切换（按日期 / 按选题）** — Task 13
- ✅ **Tab 2 按日期：左栏报告索引 + 右主报告阅读（元信息 / 前一天热点 / 选题卡片）+ 重新生成按钮** — Task 13 + 14
- ✅ **Tab 2 按选题：时间范围切换 + 标签筛选 + 跳回报告** — Task 15
- ✅ **Tab 3：平台开关 / 关键词 Tag / 博主列表（+新增对话框 / 暂停 / 删除）+ 定时说明信息条 + 保存按钮** — Task 16
- ✅ **数据访问层抽象（`lib/data/*`）+ TODO(api) 锚点** — Tasks 6/7/14
- ✅ **TS 类型** — Task 3
- ✅ **假数据规模（14 天内容 / 7 天报告 / 3 分类）** — Tasks 6/7
- ✅ **shadcn/ui + Tailwind v4 + dayjs + sonner** — Tasks 1/2
- ✅ **Vitest 测试 data/utils 层** — Tasks 4/6/7
- ✅ **不做后端 / 不做持久化 / 不做暗色模式 / 不做移动端** — 均不在任务列表中

**类型一致性**：所有 task 中使用的 `ContentItem`/`DailyReport`/`TopicSuggestion`/`MonitorSettings`/`Platform` 均在 Task 3 定义，data 函数签名与 Provider Context 签名一致。

**占位符扫描**：未发现 TBD/TODO/"later" 类占位（代码里的 `TODO(api):` 是约定锚点）。

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-20-content-monitor-prototype.md`. Two execution options:

**1. Subagent-Driven (recommended)** — 每个 Task 派发一个全新 subagent 执行，任务间双阶段 review，迭代快、主会话上下文干净

**2. Inline Execution** — 在当前会话逐任务执行，带 checkpoint 供中途审阅

**Which approach?**
