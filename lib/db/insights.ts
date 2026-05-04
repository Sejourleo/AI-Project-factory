import { sql, db, ensureMigrated } from './client'
import type { InsightSnapshot, NoteSummary, TopicInsight } from '@/lib/types'

type NoteSummaryRow = {
  note_id: string
  summary: string
  keywords: string[]
  key_points: string[]
  highlights: string[]
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
  source_note_ids: string[]
  insights: TopicInsight[]
  model: string
}

function rowToSummary(r: NoteSummaryRow): NoteSummary {
  return {
    noteId: r.note_id,
    summary: r.summary,
    keywords: r.keywords ?? [],
    keyPoints: r.key_points ?? [],
    highlights: r.highlights ?? [],
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
    sourceNoteIds: r.source_note_ids ?? [],
    insights: r.insights ?? [],
    model: r.model,
  }
}

export async function upsertNoteSummary(
  s: NoteSummary & { model: string },
): Promise<void> {
  await ensureMigrated()
  await sql`
    INSERT INTO note_summaries
      (note_id, summary, keywords, key_points, highlights, audience, model, created_at)
    VALUES (
      ${s.noteId}, ${s.summary},
      ${JSON.stringify(s.keywords)}::jsonb,
      ${JSON.stringify(s.keyPoints)}::jsonb,
      ${JSON.stringify(s.highlights)}::jsonb,
      ${s.audience ?? null},
      ${s.model},
      ${new Date().toISOString()}
    )
    ON CONFLICT (note_id) DO NOTHING
  `
}

export async function getNoteSummaries(
  noteIds: string[],
): Promise<Map<string, NoteSummary>> {
  await ensureMigrated()
  const out = new Map<string, NoteSummary>()
  if (noteIds.length === 0) return out
  const { rows } = await db.query<NoteSummaryRow>(
    `SELECT * FROM note_summaries WHERE note_id = ANY($1::text[])`,
    [noteIds],
  )
  for (const r of rows) out.set(r.note_id, rowToSummary(r))
  return out
}

export async function insertInsightSnapshot(input: {
  categoryId: string
  generatedAt: string
  status: 'success' | 'error'
  errorMessage?: string
  sourceNoteIds: string[]
  insights: TopicInsight[]
  model: string
}): Promise<number> {
  await ensureMigrated()
  const { rows } = await sql<{ id: number }>`
    INSERT INTO topic_insights
      (category_id, generated_at, status, error_message,
       source_note_ids, insights, model)
    VALUES (
      ${input.categoryId}, ${input.generatedAt}, ${input.status},
      ${input.errorMessage ?? null},
      ${JSON.stringify(input.sourceNoteIds)}::jsonb,
      ${JSON.stringify(input.insights)}::jsonb,
      ${input.model}
    )
    RETURNING id
  `
  return rows[0].id
}

export async function getInsightSnapshot(id: number): Promise<InsightSnapshot | undefined> {
  await ensureMigrated()
  const { rows } = await sql<InsightRow>`SELECT * FROM topic_insights WHERE id = ${id}`
  return rows.length === 0 ? undefined : rowToSnapshot(rows[0])
}

export async function getLatestInsightSnapshot(
  categoryId: string,
): Promise<InsightSnapshot | undefined> {
  await ensureMigrated()
  const { rows } = await sql<InsightRow>`
    SELECT * FROM topic_insights
    WHERE category_id = ${categoryId}
    ORDER BY generated_at DESC, id DESC
    LIMIT 1
  `
  return rows.length === 0 ? undefined : rowToSnapshot(rows[0])
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

export async function listInsightSnapshots(params: {
  categoryId: string
  limit?: number
  cursor?: string
}): Promise<{ items: InsightSnapshot[]; nextCursor?: string }> {
  await ensureMigrated()
  const limit = Math.min(params.limit ?? 20, 100)
  const decoded = params.cursor ? decodeCursor(params.cursor) : null

  const { rows } = decoded
    ? await sql<InsightRow>`
        SELECT * FROM topic_insights
        WHERE category_id = ${params.categoryId}
          AND (generated_at, id) < (${decoded.generatedAt}, ${decoded.id})
        ORDER BY generated_at DESC, id DESC
        LIMIT ${limit + 1}
      `
    : await sql<InsightRow>`
        SELECT * FROM topic_insights
        WHERE category_id = ${params.categoryId}
        ORDER BY generated_at DESC, id DESC
        LIMIT ${limit + 1}
      `

  const items = rows.slice(0, limit).map(rowToSnapshot)
  const hasMore = rows.length > limit
  const nextCursor = hasMore
    ? encodeCursor(items[items.length - 1].generatedAt, items[items.length - 1].id)
    : undefined
  return { items, nextCursor }
}
