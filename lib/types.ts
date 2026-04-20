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
