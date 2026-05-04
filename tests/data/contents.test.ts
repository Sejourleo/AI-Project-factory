import { describe, it, expect } from 'vitest'
import { getContentsByDate, getDateBuckets, getPlatformCounts } from '@/lib/data/contents'
import type { Platform } from '@/lib/types'

// CONTENTS_SEED 在模块加载时用真实 today 生成 14 天数据；
// 测试用真实日期窗口里的某天，避免 fake-timer 与 seed 生成时序错位。
const TARGET_DATE = (() => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - 1) // 昨天，必在窗口内
  return d.toISOString().slice(0, 10)
})()

describe('contents data access', () => {
  it('getContentsByDate 返回指定分类 + 日期的内容，且按 hotScore 降序', async () => {
    const items = await getContentsByDate('claudecode', TARGET_DATE)
    expect(items.length).toBeGreaterThan(0)
    expect(items.every((i) => i.categoryId === 'claudecode')).toBe(true)
    expect(items.every((i) => i.collectedAt.startsWith(TARGET_DATE))).toBe(true)
    for (let i = 1; i < items.length; i++) {
      expect(items[i - 1].hotScore).toBeGreaterThanOrEqual(items[i].hotScore)
    }
  })

  it('getContentsByDate 可按平台筛选', async () => {
    const platforms: Platform[] = ['douyin', 'weibo']
    const items = await getContentsByDate('claudecode', TARGET_DATE, platforms)
    expect(items.every((i) => platforms.includes(i.platform))).toBe(true)
  })

  it('getDateBuckets 返回过去 14 天，每天带计数，升序', async () => {
    const buckets = await getDateBuckets('claudecode', 14)
    expect(buckets).toHaveLength(14)
    // 第 0 天到第 13 天升序、最后一天即今天
    expect(buckets.every((b) => b.count >= 0)).toBe(true)
    for (let i = 1; i < buckets.length; i++) {
      expect(buckets[i - 1].date < buckets[i].date).toBe(true)
    }
  })

  it('getPlatformCounts 返回各平台当日条数，包含未出现的平台为 0', async () => {
    const counts = await getPlatformCounts('claudecode', TARGET_DATE)
    expect(Object.keys(counts).sort()).toEqual(
      ['bilibili', 'douyin', 'twitter', 'wechat', 'weibo', 'xiaohongshu', 'zhihu']
    )
    const total = Object.values(counts).reduce((s, n) => s + n, 0)
    const all = await getContentsByDate('claudecode', TARGET_DATE)
    expect(total).toBe(all.length)
  })
})
