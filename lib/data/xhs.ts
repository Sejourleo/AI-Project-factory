import type { ContentItem, KeywordConfig } from '@/lib/types'

const TTL_MS = 5 * 60 * 1000
const cache = new Map<string, { items: ContentItem[]; expiresAt: number }>()
const inflight = new Map<string, Promise<ContentItem[]>>()

async function fetchNotesFromDb(categoryId: string): Promise<ContentItem[]> {
  const qs = new URLSearchParams({ categoryId, platform: 'xiaohongshu' })
  const res = await fetch(`/api/notes?${qs.toString()}`, { cache: 'no-store' })
  if (!res.ok) {
    console.warn('[xhs] query failed', res.status)
    return []
  }
  const json = (await res.json()) as { items: ContentItem[] }
  return json.items ?? []
}

async function collectOne(categoryId: string, keyword: string): Promise<void> {
  try {
    const res = await fetch('/api/xhs/collect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryId, keyword }),
    })
    if (!res.ok) {
      console.warn('[xhs] collect failed', keyword, res.status)
    }
  } catch (err) {
    console.warn('[xhs] collect error', keyword, err)
  }
}

export function invalidateXhs(categoryId: string): void {
  for (const key of Array.from(cache.keys())) {
    if (key.startsWith(`${categoryId}:`)) cache.delete(key)
  }
}

export async function getXhsNotes(
  categoryId: string,
  keywords: KeywordConfig[] | undefined
): Promise<ContentItem[]> {
  if (!keywords || keywords.length === 0) return []
  const enabled = keywords.filter((k) => k.platforms.includes('xiaohongshu'))
  if (enabled.length === 0) return []
  const values = enabled.map((k) => k.value)
  const cacheKey = `${categoryId}:${values.slice().sort().join(',')}`
  const cached = cache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.items
  const existing = inflight.get(cacheKey)
  if (existing) return existing

  const promise = (async () => {
    try {
      let items = await fetchNotesFromDb(categoryId)
      if (items.length === 0) {
        await Promise.all(values.map((kw) => collectOne(categoryId, kw)))
        items = await fetchNotesFromDb(categoryId)
      }
      cache.set(cacheKey, { items, expiresAt: Date.now() + TTL_MS })
      return items
    } finally {
      inflight.delete(cacheKey)
    }
  })()

  inflight.set(cacheKey, promise)
  return promise
}
