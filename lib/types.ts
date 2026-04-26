export type Platform =
  | 'douyin'
  | 'xiaohongshu'
  | 'weibo'
  | 'bilibili'
  | 'twitter'
  | 'wechat'
  | 'zhihu'

export const PLATFORMS: Array<{ id: Platform; name: string; color: string; icon: string }> = [
  { id: 'douyin',      name: '抖音',       color: '#1F2937', icon: '🎵' },
  { id: 'xiaohongshu', name: '小红书',     color: '#22C55E', icon: '📕' },
  { id: 'weibo',       name: '微博',       color: '#F97316', icon: '🔥' },
  { id: 'bilibili',    name: 'B站',        color: '#00AEEC', icon: '📺' },
  { id: 'twitter',     name: 'Twitter/X',  color: '#000000', icon: '𝕏' },
  { id: 'wechat',      name: '公众号',     color: '#059669', icon: '💬' },
  { id: 'zhihu',       name: '知乎',       color: '#6366F1', icon: '💡' },
]

export type KeywordConfig = {
  value: string
  platforms: Platform[]
}

export type MonitorSettings = {
  keywords: KeywordConfig[]
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
  summary: string
  author: string
  publishedAt: string
  collectedAt: string
  url: string
  coverImage?: string
  stats: { likes: number; comments?: number; shares?: number; views: number }
  hotScore: number
  tags: string[]
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

export type NoteSummary = {
  noteId: string
  summary: string
  keywords: string[]
  keyPoints: string[]
  highlights: string[]
  audience?: string
}

export type TopicInsight = {
  title: string
  angle: string
  evidenceNoteIds: string[]
  audience: string
  contentFormat: string
  differentiation: string
  tags: string[]
}

export type InsightSnapshot = {
  id: number
  categoryId: string
  generatedAt: string
  status: 'success' | 'error'
  errorMessage?: string
  sourceNoteIds: string[]
  insights: TopicInsight[]
  model: string
}
