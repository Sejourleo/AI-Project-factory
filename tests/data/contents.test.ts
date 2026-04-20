import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getContentsByDate, getDateBuckets, getPlatformCounts } from '@/lib/data/contents'
import type { Platform } from '@/lib/types'

describe('contents data access', () => {
  beforeEach(() => {
    // Fake Date only — leave setTimeout real so data-access sleep() resolves.
    vi.useFakeTimers({ toFake: ['Date'] })
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
