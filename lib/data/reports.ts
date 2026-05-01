import type { DailyReport, TopicSuggestion, InsightSnapshot } from '@/lib/types'
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

export async function getHotTags(
  categoryId: string,
  days: 7 | 30 = 7,
  limit = 6
): Promise<Array<{ tag: string; count: number }>> {
  // TODO(api): GET /api/reports/hot-tags?categoryId=...&days=...
  await sleep(30)
  const dateSet = new Set(pastNDays(days))
  const counts = new Map<string, number>()
  for (const r of REPORTS_SEED) {
    if (r.categoryId !== categoryId) continue
    if (!dateSet.has(r.date)) continue
    for (const t of r.topics) {
      for (const tag of t.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1)
      }
    }
  }
  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, limit)
}

export type SnapshotListItem = {
  id: number
  generatedAt: string
  status: 'success' | 'error'
  errorMessage?: string
  model: string
  insightsCount: number
  sourceCount: number
}

export async function getLatestInsight(
  categoryId: string
): Promise<InsightSnapshot | null> {
  const res = await fetch(
    `/api/insights/latest?categoryId=${encodeURIComponent(categoryId)}`,
    { cache: 'no-store' }
  )
  if (!res.ok) return null
  return (await res.json()) as InsightSnapshot | null
}

export async function listInsightSnapshots(
  categoryId: string,
  opts?: { limit?: number; cursor?: string }
): Promise<{ items: SnapshotListItem[]; nextCursor?: string }> {
  const qs = new URLSearchParams({ categoryId })
  if (opts?.limit) qs.set('limit', String(opts.limit))
  if (opts?.cursor) qs.set('cursor', opts.cursor)
  const res = await fetch(`/api/insights?${qs}`, { cache: 'no-store' })
  if (!res.ok) return { items: [] }
  return (await res.json()) as { items: SnapshotListItem[]; nextCursor?: string }
}

export async function getInsightSnapshot(
  id: number
): Promise<InsightSnapshot | null> {
  const res = await fetch(`/api/insights/${id}`, { cache: 'no-store' })
  if (!res.ok) return null
  return (await res.json()) as InsightSnapshot
}

export async function regenerateInsight(
  categoryId: string
): Promise<{
  ok: boolean
  snapshotId?: number
  insightsCount?: number
  sourceCount?: number
  error?: string
}> {
  const res = await fetch('/api/insights/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ categoryId }),
  })
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    return {
      ok: false,
      error: (body.error as string) ?? `HTTP ${res.status}`,
    }
  }
  return {
    ok: true,
    snapshotId: body.snapshotId as number,
    insightsCount: body.insightsCount as number,
    sourceCount: body.sourceCount as number,
  }
}

export async function generateByKeyword(
  categoryId: string,
  keywords: string[]
): Promise<{
  ok: boolean
  snapshotId?: number
  insightsCount?: number
  sourceCount?: number
  error?: string
}> {
  const res = await fetch('/api/insights/generate-by-keyword', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ categoryId, keywords }),
  })
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    return {
      ok: false,
      error: (body.error as string) ?? `HTTP ${res.status}`,
    }
  }
  return {
    ok: true,
    snapshotId: body.snapshotId as number,
    insightsCount: body.insightsCount as number,
    sourceCount: body.sourceCount as number,
  }
}
