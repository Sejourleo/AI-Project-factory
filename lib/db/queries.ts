import type Database from 'better-sqlite3'
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

export function logQuerySuccess(
  db: Database.Database,
  input: {
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
  }
): number {
  let queryId = 0
  const tx = db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO keyword_queries
        (category_id, keyword, platform, started_at, finished_at, status, returned_count)
      VALUES (?, ?, ?, ?, ?, 'success', ?)
    `).run(
      input.categoryId, input.keyword, input.platform,
      input.startedAt, input.finishedAt, input.notes.length
    )
    queryId = Number(info.lastInsertRowid)
    const insertNote = db.prepare(`
      INSERT OR IGNORE INTO query_notes
        (query_id, note_id, hot_score_snapshot, likes_snapshot, comments_snapshot, views_snapshot)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    for (const n of input.notes) {
      insertNote.run(queryId, n.noteId, n.hotScore, n.likes, n.comments, n.views)
    }
  })
  tx()
  return queryId
}

export function logQueryError(
  db: Database.Database,
  input: {
    categoryId: string
    keyword: string
    platform: Platform
    startedAt: string
    finishedAt: string
    errorMessage: string
  }
): number {
  const info = db.prepare(`
    INSERT INTO keyword_queries
      (category_id, keyword, platform, started_at, finished_at, status,
       returned_count, error_message)
    VALUES (?, ?, ?, ?, ?, 'error', 0, ?)
  `).run(
    input.categoryId, input.keyword, input.platform,
    input.startedAt, input.finishedAt, input.errorMessage
  )
  return Number(info.lastInsertRowid)
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
    const [startedAt, idStr] = Buffer.from(cursor, 'base64').toString('utf8').split('|')
    return { startedAt, id: Number(idStr) }
  } catch {
    return null
  }
}

export function listQueries(
  db: Database.Database,
  params: ListQueriesParams
): ListQueriesResult {
  const limit = Math.min(params.limit ?? 50, 200)
  const where: string[] = ['category_id = @category_id']
  const bind: Record<string, unknown> = { category_id: params.categoryId, limit: limit + 1 }
  if (params.keyword) { where.push('keyword = @keyword'); bind.keyword = params.keyword }
  if (params.platform) { where.push('platform = @platform'); bind.platform = params.platform }
  if (params.status) { where.push('status = @status'); bind.status = params.status }
  if (params.cursor) {
    const decoded = decodeCursor(params.cursor)
    if (decoded) {
      where.push('(started_at, id) < (@cursor_started, @cursor_id)')
      bind.cursor_started = decoded.startedAt
      bind.cursor_id = decoded.id
    }
  }
  const sql = `
    SELECT * FROM keyword_queries
    WHERE ${where.join(' AND ')}
    ORDER BY started_at DESC, id DESC
    LIMIT @limit
  `
  const rows = db.prepare(sql).all(bind) as QueryRow[]
  const items = rows.slice(0, limit).map(rowToSummary)
  const hasMore = rows.length > limit
  const nextCursor = hasMore
    ? encodeCursor(items[items.length - 1].startedAt, items[items.length - 1].id)
    : undefined
  return { items, nextCursor }
}

export function getQueryWithNotes(
  db: Database.Database,
  queryId: number
): QueryDetail | undefined {
  const row = db.prepare('SELECT * FROM keyword_queries WHERE id = ?').get(queryId) as QueryRow | undefined
  if (!row) return undefined
  const notes = db.prepare(`
    SELECT n.*, qn.hot_score_snapshot, qn.likes_snapshot, qn.comments_snapshot, qn.views_snapshot
    FROM query_notes qn
    JOIN collected_notes n ON n.id = qn.note_id
    WHERE qn.query_id = ?
    ORDER BY qn.hot_score_snapshot DESC NULLS LAST, n.id
  `).all(queryId) as Array<Record<string, unknown>>

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
    coverImage: n.cover_image as string | undefined,
    stats: {
      likes: Number(n.likes ?? 0),
      comments: n.comments == null ? undefined : Number(n.comments),
      shares: n.shares == null ? undefined : Number(n.shares),
      views: Number(n.views ?? 0),
    },
    hotScore: Number(n.hot_score ?? 0),
    tags: JSON.parse(String(n.tags ?? '[]')),
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
