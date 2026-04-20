import type { DailyReport, TopicSuggestion } from '@/lib/types'
import { REPORTS_SEED } from '@/lib/fixtures/reports'
import { pastNDays } from '@/lib/utils/dates'

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export async function getReportList(
  categoryId: string
): Promise<Array<Pick<DailyReport, 'id' | 'date' | 'summary'>>> {
  // TODO(api): GET /api/reports?categoryId=...
  await sleep(30)
  return REPORTS_SEED
    .filter((r) => r.categoryId === categoryId)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((r) => ({ id: r.id, date: r.date, summary: r.summary }))
}

export async function getReportByDate(
  categoryId: string,
  date: string
): Promise<DailyReport | null> {
  // TODO(api): GET /api/reports/:categoryId/:date
  await sleep(40)
  return REPORTS_SEED.find((r) => r.categoryId === categoryId && r.date === date) ?? null
}

export async function getTopicsByRange(
  categoryId: string,
  days: 7 | 30,
  tags?: string[]
): Promise<Array<TopicSuggestion & { reportDate: string }>> {
  // TODO(api): GET /api/topics?categoryId=...&days=...&tags=...
  await sleep(50)
  const dateSet = new Set(pastNDays(days))
  const result: Array<TopicSuggestion & { reportDate: string }> = []
  for (const r of REPORTS_SEED) {
    if (r.categoryId !== categoryId) continue
    if (!dateSet.has(r.date)) continue
    for (const t of r.topics) {
      if (tags && tags.length > 0 && !tags.some((tag) => t.tags.includes(tag))) continue
      result.push({ ...t, reportDate: r.date })
    }
  }
  return result.sort((a, b) => b.reportDate.localeCompare(a.reportDate))
}

export async function regenerateReport(_categoryId: string, _date: string): Promise<void> {
  // TODO(api): POST /api/reports/generate { categoryId, date }
  await sleep(2000)
}
