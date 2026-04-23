import type { ContentItem } from '@/lib/types'

type WechatDatum = {
  title: string
  content: string
  wx_name: string
  url: string
  short_link: string
  classify: string
  praise: number
  read: number
  publish_time: number
  ghid: string
}

type SearchResponse = { items: WechatDatum[]; total: number }

const TTL_MS = 5 * 60 * 1000
const cache = new Map<string, { items: ContentItem[]; expiresAt: number }>()
const inflight = new Map<string, Promise<ContentItem[]>>()

function hotScoreOf(read: number, praise: number): number {
  const raw = 20 + 15 * Math.log10((read ?? 0) + 1) + 8 * Math.log10((praise ?? 0) + 1)
  return Math.max(0, Math.min(100, Math.round(raw)))
}

function mapToContentItem(
  d: WechatDatum,
  categoryId: string,
  keyword: string
): ContentItem {
  const publishedAt = new Date((d.publish_time ?? 0) * 1000).toISOString()
  return {
    id: `wechat-${d.ghid}-${d.publish_time}`,
    categoryId,
    platform: 'wechat',
    title: d.title,
    summary: (d.content ?? '').replace(/\s+/g, ' ').trim().slice(0, 120),
    author: d.wx_name,
    publishedAt,
    collectedAt: publishedAt,
    url: d.url || d.short_link,
    stats: {
      likes: d.praise ?? 0,
      views: d.read ?? 0,
    },
    hotScore: hotScoreOf(d.read ?? 0, d.praise ?? 0),
    tags: d.classify ? [d.classify] : [],
    matchedBy: { type: 'keyword', value: keyword },
  }
}

async function fetchOneKeyword(
  categoryId: string,
  keyword: string
): Promise<ContentItem[]> {
  const cacheKey = `${categoryId}:${keyword}`
  const cached = cache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.items
  const existing = inflight.get(cacheKey)
  if (existing) return existing

  const promise = (async () => {
    try {
      const res = await fetch('/api/wechat/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword, period: 7 }),
      })
      if (!res.ok) {
        console.warn('[wechat] upstream failed', keyword, res.status)
        return []
      }
      const json = (await res.json()) as SearchResponse
      const items = (json.items ?? []).map((d) => mapToContentItem(d, categoryId, keyword))
      cache.set(cacheKey, { items, expiresAt: Date.now() + TTL_MS })
      return items
    } catch (err) {
      console.warn('[wechat] fetch error', keyword, err)
      return []
    } finally {
      inflight.delete(cacheKey)
    }
  })()

  inflight.set(cacheKey, promise)
  return promise
}

export async function getWechatArticles(
  categoryId: string,
  keywords: string[] | undefined
): Promise<ContentItem[]> {
  if (!keywords || keywords.length === 0) return []
  const batches = await Promise.all(
    keywords.map((kw) => fetchOneKeyword(categoryId, kw))
  )
  const byId = new Map<string, ContentItem>()
  for (const items of batches) {
    for (const it of items) {
      if (!byId.has(it.id)) byId.set(it.id, it)
    }
  }
  return Array.from(byId.values())
}
