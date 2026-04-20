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
