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
  color: string
  createdAt: string
  settings: MonitorSettings
}

export const CATEGORY_COLORS = [
  '#6366f1', // indigo
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#8b5cf6', // violet
  '#ef4444', // red
  '#84cc16', // lime
] as const

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
