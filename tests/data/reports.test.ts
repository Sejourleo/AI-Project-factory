import { describe, it, expect } from 'vitest'
import { getReportList, getReportByDate, getTopicsByRange } from '@/lib/data/reports'

describe('reports data access', () => {
  // No fake timers: REPORTS_SEED is built at module load using real Date.now(),
  // so the rolling 7-day window must match real time to overlap with seeded dates.

  it('getReportList 返回该分类所有报告，按日期降序（最新在前）', async () => {
    const list = await getReportList('claudecode')
    expect(list.length).toBe(7)
    for (let i = 1; i < list.length; i++) {
      expect(list[i - 1].date >= list[i].date).toBe(true)
    }
    expect(list[0]).toHaveProperty('summary')
  })

  it('getReportByDate 命中返回完整报告，未命中返回 null', async () => {
    const list = await getReportList('claudecode')
    const seededDate = list[0].date
    const hit = await getReportByDate('claudecode', seededDate)
    expect(hit).not.toBeNull()
    expect(hit!.topics.length).toBeGreaterThanOrEqual(3)

    const miss = await getReportByDate('claudecode', '2020-01-01')
    expect(miss).toBeNull()
  })

  it('getTopicsByRange 返回近 N 天命中的选题，带 reportDate', async () => {
    const topics = await getTopicsByRange('claudecode', 7)
    expect(topics.length).toBeGreaterThan(0)
    expect(topics[0]).toHaveProperty('reportDate')
  })

  it('getTopicsByRange 可按 tags 筛选', async () => {
    const topics = await getTopicsByRange('claudecode', 7, ['MCP'])
    expect(topics.every((t) => t.tags.includes('MCP'))).toBe(true)
  })
})
