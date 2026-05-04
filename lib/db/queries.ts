import { db, sql, ensureMigrated } from './client'
import type { ContentItem, Platform } from '@/lib/types'

export type QueryStatus = 'success' | 'error'

export type QuerySummary = {
  id: number
  categoryId: string
  keyword: string
  platform: Platform
  startedAt: string
  finishedAt: string | null
  status: QueryStatus
  returnedCount: number
  errorMessage: string | null
}

export type NoteSnapshot = {
  hotScore: number | null
  likes: number | null
  comments: number | null
  views: number | null
}

export type QueryNote = ContentItem & { snapshot: NoteSnapshot }

export type QueryDetail = {
  query: QuerySummary
  notes: QueryNote[]
}

type QueryRow = {
  id: number
  category_id: string
  keyword: string
  platform: string
  started_at: string
  finished_at: string | null
  status: string
  returned_count: number
  error_message: string | null
}

function rowToSummary(r: QueryRow): QuerySummary {
  return {
    id: r.id,
    categoryId: r.category_id,
    keyword: r.keyword,
    platform: r.platform as Platform,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    status: r.status as QueryStatus,
    returnedCount: r.returned_count,
    errorMessage: r.error_message,
  }
}

export async function logQuerySuccess(input: {
  categoryId: string
  keyword: string
  platform: Platform
  startedAt: string
  finishedAt: string
  notes: Array<{
    noteId: string
    hotScore: number | null
    likes: number | null
    comments: number | null
    views: number | null
  }>
}): Promise<number> {
  await ensureMigrated()
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query<{ id: number }>(
      `INSERT INTO keyword_queries
         (category_id, keyword, platform, started_at, finished_at, status, returned_count)
       VALUES ($1, $2, $3, $4, $5, 'success', $6)
       RETURNING id`,
      [input.categoryId, input.keyword, input.platform,
       input.startedAt, input.finishedAt, input.notes.length],
    )
    const queryId = rows[0].id
    for (const n of input.notes) {
      await client.query(
        `INSERT INTO query_notes
           (query_id, note_id, hot_score_snapshot, likes_snapshot, comments_snapshot, views_snapshot)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (query_id, note_id) DO NOTHING`,
        [queryId, n.noteId, n.hotScore, n.likes, n.comments, n.views],
      )
    }
    await client.query('COMMIT')
    return queryId
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}

export async function logQueryError(input: {
  categoryId: string
  keyword: string
  platform: Platform
  startedAt: string
  finishedAt: string
  errorMessage: string
}): Promise<number> {
  await ensureMigrated()
  const { rows } = await sql<{ id: number }>`
    INSERT INTO keyword_queries
      (category_id, keyword, platform, started_at, finished_at, status,
       returned_count, error_message)
    VALUES (${input.categoryId}, ${input.keyword}, ${input.platform},
            ${input.startedAt}, ${input.finishedAt}, 'error', 0, ${input.errorMessage})
    RETURNING id
  `
  return rows[0].id
}

export type ListQueriesParams = {
  categoryId: string
  keyword?: string
  platform?: Platform
  status?: QueryStatus
  limit?: number
  cursor?: string
}

export type ListQueriesResult = {
  items: QuerySummary[]
  nextCursor?: string
}

function encodeCursor(startedAt: string, id: number): string {
  return Buffer.from(`${startedAt}|${id}`, 'utf8').toString('base64')
}

function decodeCursor(cursor: string): { startedAt: string; id: number } | null {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf8')
    const pipeIdx = decoded.lastIndexOf('|')
    if (pipeIdx === -1) return null
    const startedAt = decoded.slice(0, pipeIdx)
    const id = Number(decoded.slice(pipeIdx + 1))
    if (!startedAt || !Number.isFinite(id)) return null
    return { startedAt, id }
  } catch {
    return null
  }
}

export async function listQueries(
  params: ListQueriesParams,
): Promise<ListQueriesResult> {
  await ensureMigrated()
  const limit = Math.min(params.limit ?? 50, 200)
  const where: string[] = ['category_id = $1']
  const args: unknown[] = [params.categoryId]
  if (params.keyword) { args.push(params.keyword); where.push(`keyword = $${args.length}`) }
  if (params.platform) { args.push(params.platform); where.push(`platform = $${args.length}`) }
  if (params.status) { args.push(params.status); where.push(`status = $${args.length}`) }
  if (params.cursor) {
    const decoded = decodeCursor(params.cursor)
    if (decoded) {
      args.push(decoded.startedAt); const ai = args.length
      args.push(decoded.id);        const bi = args.length
      where.push(`(started_at, id) < ($${ai}, $${bi})`)
    }
  }
  args.push(limit + 1)
  const limitIdx = args.length

  const text = `
    SELECT * FROM keyword_queries
    WHERE ${where.join(' AND ')}
    ORDER BY started_at DESC, id DESC
    LIMIT $${limitIdx}
  `
  const { rows } = await db.query<QueryRow>(text, args)
  const items = rows.slice(0, limit).map(rowToSummary)
  const hasMore = rows.length > limit
  const nextCursor = hasMore
    ? encodeCursor(items[items.length - 1].startedAt, items[items.length - 1].id)
    : undefined
  return { items, nextCursor }
}

export async function getQueryWithNotes(queryId: number): Promise<QueryDetail | undefined> {
  await ensureMigrated()
  const { rows: qRows } = await sql<QueryRow>`SELECT * FROM keyword_queries WHERE id = ${queryId}`
  if (qRows.length === 0) return undefined
  const row = qRows[0]
  const { rows: notes } = await sql<Record<string, unknown>>`
    SELECT n.*, qn.hot_score_snapshot, qn.likes_snapshot, qn.comments_snapshot, qn.views_snapshot
    FROM query_notes qn
    JOIN collected_notes n ON n.id = qn.note_id
    WHERE qn.query_id = ${queryId}
    ORDER BY qn.hot_score_snapshot DESC NULLS LAST, n.id
  `
  const noteItems: QueryNote[] = notes.map((n) => ({
    id: String(n.id),
    categoryId: String(n.category_id),
    platform: String(n.platform) as Platform,
    title: String(n.title),
    summary: String(n.summary),
    author: String(n.author),
    publishedAt: String(n.published_at),
    collectedAt: String(n.collected_at),
    url: String(n.url),
    coverImage: n.cover_image == null ? undefined : String(n.cover_image),
    stats: {
      likes: Number(n.likes ?? 0),
      comments: n.comments == null ? undefined : Number(n.comments),
      shares: n.shares == null ? undefined : Number(n.shares),
      views: Number(n.views ?? 0),
    },
    hotScore: Number(n.hot_score ?? 0),
    // tags 已是 JSONB → JS 数组，不再 JSON.parse
    tags: (n.tags as string[]) ?? [],
    matchedBy: { type: 'keyword', value: row.keyword },
    snapshot: {
      hotScore: n.hot_score_snapshot == null ? null : Number(n.hot_score_snapshot),
      likes: n.likes_snapshot == null ? null : Number(n.likes_snapshot),
      comments: n.comments_snapshot == null ? null : Number(n.comments_snapshot),
      views: n.views_snapshot == null ? null : Number(n.views_snapshot),
    },
  }))
  return { query: rowToSummary(row), notes: noteItems }
}
