import type { ContentItem, Platform } from '@/lib/types'
import { PLATFORMS } from '@/lib/types'
import { CONTENTS_SEED } from '@/lib/fixtures/contents'
import { pastNDays } from '@/lib/utils/dates'
import dayjs from 'dayjs'

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

export type MonthCell = {
  date: string
  count: number
  platforms: Record<Platform, number>
}

export async function getMonthCells(
  categoryId: string,
  year: number,
  month: number
): Promise<MonthCell[]> {
  // TODO(api): GET /api/contents/month?categoryId=...&year=...&month=...
  await sleep(40)
  const first = dayjs(`${year}-${String(month).padStart(2, '0')}-01`)
  const daysInMonth = first.daysInMonth()
  const cells: MonthCell[] = []
  for (let d = 1; d <= daysInMonth; d++) {
    const date = first.date(d).format('YYYY-MM-DD')
    const platforms: Record<Platform, number> = {
      douyin: 0, xiaohongshu: 0, weibo: 0, bilibili: 0,
    }
    let count = 0
    for (const c of CONTENTS_SEED) {
      if (c.categoryId === categoryId && c.collectedAt.startsWith(date)) {
        platforms[c.platform] += 1
        count += 1
      }
    }
    cells.push({ date, count, platforms })
  }
  return cells
}

export type CategoryStats = {
  totalCount: number
  weekCount: number
  platformsCovered: number
  topPlatform: { id: Platform; name: string; count: number } | null
}

export async function getCategoryStats(categoryId: string): Promise<CategoryStats> {
  // TODO(api): GET /api/contents/stats?categoryId=...
  await sleep(30)
  const weekSet = new Set(pastNDays(7))
  const perPlatform: Record<Platform, number> = {
    douyin: 0, xiaohongshu: 0, weibo: 0, bilibili: 0,
  }
  let totalCount = 0
  let weekCount = 0
  for (const c of CONTENTS_SEED) {
    if (c.categoryId !== categoryId) continue
    totalCount += 1
    perPlatform[c.platform] += 1
    const day = c.collectedAt.slice(0, 10)
    if (weekSet.has(day)) weekCount += 1
  }
  const platformsCovered = (Object.values(perPlatform) as number[]).filter((n) => n > 0).length
  let topPlatform: CategoryStats['topPlatform'] = null
  for (const p of PLATFORMS) {
    const n = perPlatform[p.id]
    if (n > 0 && (!topPlatform || n > topPlatform.count)) {
      topPlatform = { id: p.id, name: p.name, count: n }
    }
  }
  return { totalCount, weekCount, platformsCovered, topPlatform }
}

export async function getRecentContents(
  categoryId: string,
  limit = 5
): Promise<ContentItem[]> {
  // TODO(api): GET /api/contents/recent?categoryId=...&limit=...
  await sleep(30)
  return CONTENTS_SEED
    .filter((c) => c.categoryId === categoryId)
    .sort((a, b) => b.collectedAt.localeCompare(a.collectedAt) || b.hotScore - a.hotScore)
    .slice(0, limit)
}
