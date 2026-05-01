import type { ContentItem, Platform } from '@/lib/types'
import { PLATFORMS } from '@/lib/types'
import { CATEGORIES_SEED } from './categories'
import { pastNDays } from '@/lib/utils/dates'

const ALL_PLATFORMS: Platform[] = PLATFORMS.map((p) => p.id)

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

const SUMMARY_TEMPLATES: Record<string, string[]> = {
  claudecode: [
    '短视频展示使用 Claude Code 快速开发微信小程序的全过程，引发大量关注与讨论…',
    'UP主分别用传统方式和 Claude Code 方式完成同一个项目，详细对比开发效率和代码质量…',
    '作者分享了 MCP 工具链从安装到落地的完整配置流程，覆盖多个常见坑点…',
    'Subagent 模板库实战演示，展示如何在复杂任务中编排多个专业子 agent…',
    '深度拆解 Claude Hooks 的触发时机与使用场景，附带实际项目示例…',
  ],
  vibecoding: [
    '从传统流程切换到 Vibe Coding 后的个人体验总结，重点讨论生产力变化…',
    '一线开发者分享和 AI 结对一个月的真实感受，既有惊喜也有坑…',
    '10 个高频 Vibe Coding Prompt 整理分享，覆盖需求分析到代码生成全链路…',
  ],
  'ai-product': [
    '2026 第一季度 AI 产品横评，对比订阅价格、功能覆盖与实际体验…',
    '深度测评 AI Agent 类产品的真实工作时长和任务完成度…',
    '商业化 AI 产品盘点，包含订阅量、留存与付费转化数据…',
  ],
}

const TAG_POOLS: Record<string, string[]> = {
  claudecode: ['AI编程', 'Claude Code', '小程序', 'MCP', 'Subagent', '独立开发', '开发效率'],
  vibecoding: ['Vibe Coding', '氛围编程', 'AI 结对', 'Prompt', '对比测评', '开发效率'],
  'ai-product': ['AI产品', 'Agent', 'ChatGPT', '产品测评', '订阅制', '商业化'],
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
  const platforms: Platform[] = ALL_PLATFORMS
  const count = 15 + (hash(`${categoryId}-${date}`) % 11)  // 15-25 条

  const items: ContentItem[] = []
  for (let i = 0; i < count; i++) {
    const seed = hash(`${categoryId}-${date}-${i}`)
    const platform = pick(platforms, seed)
    const title = pick(titles, seed + i)
    const author = pick(AUTHORS, seed + i * 3)
    const useKeyword = (seed % 2) === 0
    const matchedBy = useKeyword
      ? { type: 'keyword' as const, value: pick(cat.settings.keywords, seed).value }
      : { type: 'account' as const, value: pick(cat.settings.accounts, seed).displayName }

    const hotScore =
      i === 0 || i === 1 ? 90 + (seed % 10)            // Top 2 高热
        : i < count * 0.3 ? 60 + (seed % 30)            // 中热
          : 20 + (seed % 40)                             // 低热

    const summaries = SUMMARY_TEMPLATES[categoryId] ?? SUMMARY_TEMPLATES.claudecode
    const tagPool = TAG_POOLS[categoryId] ?? TAG_POOLS.claudecode
    const tagCount = 2 + (seed % 2) // 2-3 tags
    const tags: string[] = []
    for (let t = 0; t < tagCount; t++) {
      const tag = pick(tagPool, seed + t * 7)
      if (!tags.includes(tag)) tags.push(tag)
    }

    items.push({
      id: `${categoryId}-${date}-${i}`,
      categoryId,
      platform,
      title: `${title}${i % 5 === 0 ? '（干货版）' : ''}`,
      summary: pick(summaries, seed + i),
      author,
      publishedAt: `${date}T${String(8 + (i % 12)).padStart(2, '0')}:00:00Z`,
      collectedAt: `${date}T23:00:00Z`,
      url: `https://example.com/${platform}/${categoryId}-${date}-${i}`,
      coverImage: `https://picsum.photos/seed/${categoryId}-${date}-${i}/640/360`,
      stats: {
        likes:    100 + seed % 50000,
        comments: 10 + seed % 2000,
        shares:   5  + seed % 800,
        views:    1000 + seed % 2000000,
      },
      hotScore,
      tags,
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
