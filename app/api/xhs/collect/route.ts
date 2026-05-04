import { NextResponse } from 'next/server'
import { db, ensureMigrated } from '@/lib/db/client'
import { logQueryError, logQuerySuccess } from '@/lib/db/queries'

export const runtime = 'nodejs'
export const maxDuration = 120

type XhsImage = { url?: string; url_default?: string; url_pre?: string }
type XhsUser = { nickname?: string; images?: string; red_id?: string; userid?: string; user_id?: string }
type XhsNote = {
  id?: string; note_id?: string; title?: string; desc?: string; display_title?: string
  liked_count?: number; collected_count?: number; comments_count?: number; shared_count?: number
  images_list?: XhsImage[]; cover?: XhsImage
  timestamp?: number; time?: number
  tag_info?: Array<{ name?: string }> | string[]
  user?: XhsUser
}
type XhsItem = { note?: XhsNote; model_type?: string } & Partial<XhsNote>
type UpstreamResponse = {
  success?: boolean; code?: string | number; message?: string; msg?: string
  solution?: string; retryable?: boolean
  data?: { items?: XhsItem[]; has_more?: boolean }
}

function isSuccess(json: UpstreamResponse): boolean {
  if (json.success === true) return true
  if (json.success === false) return false
  const c = json.code
  return c == null || c === 0 || c === 200 || c === '0' || c === '200'
}
function isRetryable(json: UpstreamResponse): boolean {
  if (typeof json.retryable === 'boolean') return json.retryable
  return json.code === 1001 || json.code === '1001'
}
function hotScoreOf(liked: number, comments: number, collected: number): number {
  const raw = 15 + 14 * Math.log10((liked ?? 0) + 1)
    + 10 * Math.log10((comments ?? 0) + 1)
    + 8 * Math.log10((collected ?? 0) + 1)
  return Math.max(0, Math.min(100, Math.round(raw)))
}
function pickCover(note: XhsNote): string | null {
  if (note.cover?.url_default) return note.cover.url_default
  if (note.cover?.url) return note.cover.url
  const first = note.images_list?.[0]
  return first?.url_default ?? first?.url ?? first?.url_pre ?? null
}
function pickTags(note: XhsNote): string[] {
  const info = note.tag_info
  if (!info) return []
  if (Array.isArray(info)) {
    return info.map((t) => (typeof t === 'string' ? t : t?.name ?? ''))
      .filter((s): s is string => Boolean(s)).slice(0, 4)
  }
  return []
}
function pickTimestamp(note: XhsNote): number {
  const ts = note.timestamp ?? note.time ?? 0
  if (ts > 1e12) return ts
  if (ts > 0) return ts * 1000
  return Date.now()
}

export async function POST(req: Request) {
  const apiKey = process.env.XHS_SEARCH_API_KEY
  const apiUrl = process.env.XHS_SEARCH_API_URL
  if (!apiKey || !apiUrl) {
    return NextResponse.json(
      { error: 'XHS_SEARCH_API_KEY or XHS_SEARCH_API_URL not configured' },
      { status: 500 })
  }

  let body: { categoryId?: string; keyword?: string; page?: number }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const categoryId = (body.categoryId ?? '').trim()
  const keyword = (body.keyword ?? '').trim()
  if (!categoryId || !keyword) {
    return NextResponse.json({ error: 'Missing categoryId or keyword' }, { status: 400 })
  }

  const startedAt = new Date().toISOString()
  const payload = {
    type: 9, keyword, page: String(body.page ?? 1),
    sort: 'comment_descending', note_type: 'note', note_time: 'day',
    searchId: '', sessionId: '',
  }

  const RETRY_DELAYS_MS = [10_000, 30_000, 60_000]
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

  type CallResult =
    | { kind: 'ok'; json: UpstreamResponse }
    | { kind: 'business-error'; json: UpstreamResponse }
    | { kind: 'transport-error'; status: number; detail: string }

  async function callUpstreamOnce(): Promise<CallResult> {
    try {
      const upstream = await fetch(apiUrl!, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), cache: 'no-store',
      })
      const text = await upstream.text().catch(() => '')
      let json: UpstreamResponse | null = null
      try { json = text ? (JSON.parse(text) as UpstreamResponse) : null } catch { json = null }
      if (json && (json.success != null || json.code != null || typeof json.retryable === 'boolean')) {
        if (isSuccess(json)) return { kind: 'ok', json }
        return { kind: 'business-error', json }
      }
      return { kind: 'transport-error', status: upstream.status, detail: text.slice(0, 500) }
    } catch (err) {
      return { kind: 'transport-error', status: 0, detail: err instanceof Error ? err.message : String(err) }
    }
  }

  await ensureMigrated()
  let json: UpstreamResponse | null = null
  let lastBusinessError: UpstreamResponse | null = null
  let lastTransportError: { status: number; detail: string } | null = null
  const totalAttempts = 1 + RETRY_DELAYS_MS.length

  for (let attempt = 0; attempt < totalAttempts; attempt++) {
    if (attempt > 0) await sleep(RETRY_DELAYS_MS[attempt - 1])
    const result = await callUpstreamOnce()
    if (result.kind === 'ok') { json = result.json; break }
    if (result.kind === 'transport-error') {
      lastTransportError = { status: result.status, detail: result.detail }
      continue
    }
    if (isRetryable(result.json)) { lastBusinessError = result.json; continue }
    const finishedAt = new Date().toISOString()
    const errMsg = result.json.message ?? result.json.msg ?? `code=${result.json.code}`
    await logQueryError({
      categoryId, keyword, platform: 'xiaohongshu',
      startedAt, finishedAt, errorMessage: errMsg,
    })
    return NextResponse.json({
      error: 'Upstream rejected',
      upstreamCode: result.json.code,
      upstreamMessage: result.json.message ?? result.json.msg,
      solution: result.json.solution,
    }, { status: 502 })
  }

  if (!json) {
    const finishedAt = new Date().toISOString()
    const errMsg = lastBusinessError?.message ?? lastBusinessError?.msg
      ?? `transport ${lastTransportError?.status} ${lastTransportError?.detail ?? ''}`
    await logQueryError({
      categoryId, keyword, platform: 'xiaohongshu',
      startedAt, finishedAt, errorMessage: errMsg,
    })
    return NextResponse.json({
      error: 'Upstream unstable after retries',
      attempts: totalAttempts,
      upstreamCode: lastBusinessError?.code,
      upstreamMessage: lastBusinessError?.message ?? lastBusinessError?.msg,
      transportStatus: lastTransportError?.status,
      transportDetail: lastTransportError?.detail,
    }, { status: 502 })
  }

  const items = json.data?.items ?? []
  const nowIso = new Date().toISOString()

  type SnapshotEntry = {
    noteId: string; hotScore: number; likes: number; comments: number | null; views: number
  }
  type PreparedRow = {
    id: string; category_id: string; platform: string; keyword: string
    title: string; summary: string; author: string
    author_id: string | null; author_avatar: string | null; author_red_id: string | null
    url: string; cover_image: string | null
    published_at: string; collected_at: string
    likes: number; comments: number | null; shares: number | null
    views: number; hot_score: number
    tags: string[]; raw: unknown
  }
  type RowAndSnapshot = { row: PreparedRow; snap: SnapshotEntry }
  const prepared: RowAndSnapshot[] = []
  for (const wrap of items) {
    const note: XhsNote = wrap.note ?? (wrap as XhsNote)
    const noteId = note.id ?? note.note_id
    if (!noteId || !note.title) continue
    const user = note.user ?? {}
    const publishedMs = pickTimestamp(note)
    const likes = note.liked_count ?? 0
    const comments = note.comments_count
    const shares = note.shared_count
    const collected = note.collected_count ?? 0
    const hotScore = hotScoreOf(likes, comments ?? 0, collected)
    const id = `xhs-${noteId}`
    prepared.push({
      row: {
        id, category_id: categoryId, platform: 'xiaohongshu', keyword,
        title: (note.title ?? note.display_title ?? '').slice(0, 200),
        summary: (note.desc ?? '').replace(/\s+/g, ' ').trim().slice(0, 200),
        author: user.nickname ?? '',
        author_id: user.userid ?? user.user_id ?? null,
        author_avatar: user.images ?? null,
        author_red_id: user.red_id ?? null,
        url: `https://www.xiaohongshu.com/explore/${noteId}`,
        cover_image: pickCover(note),
        published_at: new Date(publishedMs).toISOString(),
        collected_at: nowIso,
        likes, comments: comments ?? null, shares: shares ?? null,
        views: collected, hot_score: hotScore,
        tags: pickTags(note),
        raw: wrap,
      },
      snap: { noteId: id, hotScore, likes, comments: comments ?? null, views: collected },
    })
  }

  const client = await db.connect()
  try {
    await client.query('BEGIN')
    for (const p of prepared) {
      const r = p.row
      await client.query(
        `INSERT INTO collected_notes (
           id, category_id, platform, keyword,
           title, summary, author, author_id, author_avatar, author_red_id,
           url, cover_image, published_at, collected_at,
           likes, comments, shares, views, hot_score, tags, raw
         ) VALUES (
           $1, $2, $3, $4,
           $5, $6, $7, $8, $9, $10,
           $11, $12, $13, $14,
           $15, $16, $17, $18, $19, $20::jsonb, $21::jsonb
         )
         ON CONFLICT (id) DO UPDATE SET
           title = excluded.title, summary = excluded.summary,
           author = excluded.author, author_id = excluded.author_id,
           author_avatar = excluded.author_avatar, author_red_id = excluded.author_red_id,
           url = excluded.url, cover_image = excluded.cover_image,
           likes = excluded.likes, comments = excluded.comments,
           shares = excluded.shares, views = excluded.views,
           hot_score = excluded.hot_score, tags = excluded.tags,
           raw = excluded.raw, collected_at = excluded.collected_at`,
        [
          r.id, r.category_id, r.platform, r.keyword,
          r.title, r.summary, r.author, r.author_id, r.author_avatar, r.author_red_id,
          r.url, r.cover_image, r.published_at, r.collected_at,
          r.likes, r.comments, r.shares, r.views, r.hot_score,
          JSON.stringify(r.tags), JSON.stringify(r.raw),
        ],
      )
    }
    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }

  const finishedAt = new Date().toISOString()
  await logQuerySuccess({
    categoryId, keyword, platform: 'xiaohongshu',
    startedAt, finishedAt,
    notes: prepared.map((p) => p.snap),
  })

  return NextResponse.json({ ok: true, saved: prepared.length, total: items.length })
}
