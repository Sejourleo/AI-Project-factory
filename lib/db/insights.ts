import type Database from 'better-sqlite3'
import type { InsightSnapshot, NoteSummary, TopicInsight } from '@/lib/types'

type NoteSummaryRow = {
  note_id: string
  summary: string
  keywords: string
  key_points: string
  highlights: string
  audience: string | null
  model: string
  created_at: string
}

type InsightRow = {
  id: number
  category_id: string
  generated_at: string
  status: string
  error_message: string | null
  source_note_ids: string
  insights: string
  model: string
}

function rowToSummary(r: NoteSummaryRow): NoteSummary {
  return {
    noteId: r.note_id,
    summary: r.summary,
    keywords: JSON.parse(r.keywords) as string[],
    keyPoints: JSON.parse(r.key_points) as string[],
    highlights: JSON.parse(r.highlights) as string[],
    audience: r.audience ?? undefined,
  }
}

function rowToSnapshot(r: InsightRow): InsightSnapshot {
  return {
    id: r.id,
    categoryId: r.category_id,
    generatedAt: r.generated_at,
    status: r.status as 'success' | 'error',
    errorMessage: r.error_message ?? undefined,
    sourceNoteIds: JSON.parse(r.source_note_ids) as string[],
    insights: JSON.parse(r.insights) as TopicInsight[],
    model: r.model,
  }
}

export function upsertNoteSummary(
  db: Database.Database,
  s: NoteSummary & { model: string }
): void {
  db.prepare(`
    INSERT OR IGNORE INTO note_summaries
      (note_id, summary, keywords, key_points, highlights, audience, model, created_at)
    VALUES (@noteId, @summary, @keywords, @keyPoints, @highlights, @audience, @model, @createdAt)
  `).run({
    noteId: s.noteId, summary: s.summary,
    keywords: JSON.stringify(s.keywords),
    keyPoints: JSON.stringify(s.keyPoints),
    highlights: JSON.stringify(s.highlights),
    audience: s.audience ?? null,
    model: s.model,
    createdAt: new Date().toISOString(),
  })
}

export function getNoteSummaries(
  db: Database.Database,
  noteIds: string[]
): Map<string, NoteSummary> {
  const out = new Map<string, NoteSummary>()
  if (noteIds.length === 0) return out
  const placeholders = noteIds.map(() => '?').join(',')
  const rows = db
    .prepare(`SELECT * FROM note_summaries WHERE note_id IN (${placeholders})`)
    .all(...noteIds) as NoteSummaryRow[]
  for (const r of rows) out.set(r.note_id, rowToSummary(r))
  return out
}

export function insertInsightSnapshot(
  db: Database.Database,
  input: {
    categoryId: string
    generatedAt: string
    status: 'success' | 'error'
    errorMessage?: string
    sourceNoteIds: string[]
    insights: TopicInsight[]
    model: string
  }
): number {
  const info = db.prepare(`
    INSERT INTO topic_insights
      (category_id, generated_at, status, error_message,
       source_note_ids, insights, model)
    VALUES (@categoryId, @generatedAt, @status, @errorMessage,
            @sourceNoteIds, @insights, @model)
  `).run({
    categoryId: input.categoryId,
    generatedAt: input.generatedAt,
    status: input.status,
    errorMessage: input.errorMessage ?? null,
    sourceNoteIds: JSON.stringify(input.sourceNoteIds),
    insights: JSON.stringify(input.insights),
    model: input.model,
  })
  return Number(info.lastInsertRowid)
}

export function getInsightSnapshot(
  db: Database.Database,
  id: number
): InsightSnapshot | undefined {
  const r = db.prepare(`SELECT * FROM topic_insights WHERE id = ?`).get(id) as InsightRow | undefined
  return r ? rowToSnapshot(r) : undefined
}

export function getLatestInsightSnapshot(
  db: Database.Database,
  categoryId: string
): InsightSnapshot | undefined {
  const r = db.prepare(`
    SELECT * FROM topic_insights
    WHERE category_id = ?
    ORDER BY generated_at DESC, id DESC
    LIMIT 1
  `).get(categoryId) as InsightRow | undefined
  return r ? rowToSnapshot(r) : undefined
}

function encodeCursor(generatedAt: string, id: number): string {
  return Buffer.from(`${generatedAt}|${id}`, 'utf8').toString('base64')
}

function decodeCursor(c: string): { generatedAt: string; id: number } | null {
  try {
    const decoded = Buffer.from(c, 'base64').toString('utf8')
    const idx = decoded.lastIndexOf('|')
    if (idx === -1) return null
    const generatedAt = decoded.slice(0, idx)
    const id = Number(decoded.slice(idx + 1))
    if (!generatedAt || !Number.isFinite(id)) return null
    return { generatedAt, id }
  } catch { return null }
}

export function listInsightSnapshots(
  db: Database.Database,
  params: { categoryId: string; limit?: number; cursor?: string }
): { items: InsightSnapshot[]; nextCursor?: string } {
  const limit = Math.min(params.limit ?? 20, 100)
  const where: string[] = ['category_id = @category_id']
  const bind: Record<string, unknown> = { category_id: params.categoryId, limit: limit + 1 }
  if (params.cursor) {
    const d = decodeCursor(params.cursor)
    if (d) {
      where.push('(generated_at, id) < (@cur_gen, @cur_id)')
      bind.cur_gen = d.generatedAt
      bind.cur_id = d.id
    }
  }
  const rows = db.prepare(`
    SELECT * FROM topic_insights
    WHERE ${where.join(' AND ')}
    ORDER BY generated_at DESC, id DESC
    LIMIT @limit
  `).all(bind) as InsightRow[]
  const items = rows.slice(0, limit).map(rowToSnapshot)
  const hasMore = rows.length > limit
  const nextCursor = hasMore
    ? encodeCursor(items[items.length - 1].generatedAt, items[items.length - 1].id)
    : undefined
  return { items, nextCursor }
}
