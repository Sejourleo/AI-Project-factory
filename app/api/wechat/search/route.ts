import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db/client'
import { logQueryError, logQuerySuccess } from '@/lib/db/queries'

export const runtime = 'nodejs'

export type WechatDatum = {
  avatar: string; classify: string; content: string; ghid: string
  ip_wording: string; is_original: number; looking: number; praise: number
  publish_time: number; publish_time_str: string; read: number; short_link: string
  title: string; update_time: number; update_time_str: string; url: string
  wx_id: string; wx_name: string
}

type UpstreamResponse = {
  success?: boolean; code?: string | number; message?: string; msg?: string
  solution?: string; retryable?: boolean; requestId?: string
  data?: { data?: WechatDatum[]; data_number?: number; page?: number; total?: number; total_page?: number }
}

function isSuccess(json: UpstreamResponse): boolean {
  if (json.success === true) return true
  if (json.success === false) return false
  const c = json.code
  return c == null || c === 0 || c === 200 || c === '0' || c === '200'
}
function hotScoreOf(read: number, praise: number): number {
  const raw = 20 + 15 * Math.log10((read ?? 0) + 1) + 8 * Math.log10((praise ?? 0) + 1)
  return Math.max(0, Math.min(100, Math.round(raw)))
}

export async function POST(req: Request) {
  const apiKey = process.env.WECHAT_SEARCH_API_KEY
  const apiUrl = process.env.WECHAT_SEARCH_API_URL
  if (!apiKey || !apiUrl) {
    return NextResponse.json(
      { error: 'WECHAT_SEARCH_API_KEY or WECHAT_SEARCH_API_URL not configured' },
      { status: 500 })
  }

  let body: { categoryId?: string; keyword?: string; period?: number; page?: number }
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
    kw: keyword, sort_type: 1, mode: 1,
    period: body.period ?? 7, page: body.page ?? 1,
    any_kw: '', ex_kw: '', verifycode: '', type: 1,
  }

  const db = getDb()

  let json: UpstreamResponse | null = null
  let transportInfo: { status: number; detail: string } | null = null
  try {
    const upstream = await fetch(apiUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload), cache: 'no-store',
    })
    const text = await upstream.text().catch(() => '')
    try { json = text ? (JSON.parse(text) as UpstreamResponse) : null } catch { json = null }
    if (!json) transportInfo = { status: upstream.status, detail: text.slice(0, 500) }
  } catch (err) {
    transportInfo = { status: 0, detail: err instanceof Error ? err.message : String(err) }
  }

  if (!json || !isSuccess(json)) {
    const finishedAt = new Date().toISOString()
    const errMsg = json?.message ?? json?.msg ?? transportInfo?.detail ?? 'unknown error'
    logQueryError(db, {
      categoryId, keyword, platform: 'wechat',
      startedAt, finishedAt, errorMessage: errMsg,
    })
    return NextResponse.json({
      error: json ? 'Upstream rejected' : `Upstream ${transportInfo?.status ?? 0}`,
      upstreamCode: json?.code, upstreamMessage: json?.message ?? json?.msg,
      solution: json?.solution, detail: transportInfo?.detail,
    }, { status: 502 })
  }

  const items = json.data?.data ?? []
  const nowIso = new Date().toISOString()
  const upsert = db.prepare(`
    INSERT INTO collected_notes (
      id, category_id, platform, keyword,
      title, summary, author, author_id, author_avatar, author_red_id,
      url, cover_image, published_at, collected_at,
      likes, comments, shares, views, hot_score, tags, raw
    ) VALUES (
      @id, @category_id, 'wechat', @keyword,
      @title, @summary, @author, @author_id, @author_avatar, NULL,
      @url, NULL, @published_at, @collected_at,
      @likes, NULL, NULL, @views, @hot_score, @tags, @raw
    )
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title, summary = excluded.summary,
      author = excluded.author, author_id = excluded.author_id,
      author_avatar = excluded.author_avatar, url = excluded.url,
      likes = excluded.likes, views = excluded.views,
      hot_score = excluded.hot_score, tags = excluded.tags,
      raw = excluded.raw, collected_at = excluded.collected_at
  `)

  type Snap = { noteId: string; hotScore: number; likes: number; views: number }
  const prepared: Array<{ row: Record<string, unknown>; snap: Snap }> = []
  for (const d of items) {
    const target = d.url || d.short_link
    if (!target || !d.title) continue
    const id = `wechat-${createHash('sha1').update(target).digest('hex').slice(0, 16)}`
    const likes = d.praise ?? 0
    const views = d.read ?? 0
    const hotScore = hotScoreOf(views, likes)
    const publishedAt = new Date((d.publish_time ?? 0) * 1000).toISOString()
    prepared.push({
      row: {
        id, category_id: categoryId, keyword,
        title: d.title.slice(0, 200),
        summary: (d.content ?? '').replace(/\s+/g, ' ').trim().slice(0, 200),
        author: d.wx_name ?? '',
        author_id: d.wx_id ?? null,
        author_avatar: d.avatar ?? null,
        url: target,
        published_at: publishedAt,
        collected_at: nowIso,
        likes, views, hot_score: hotScore,
        tags: JSON.stringify(d.classify ? [d.classify] : []),
        raw: JSON.stringify(d),
      },
      snap: { noteId: id, hotScore, likes, views },
    })
  }

  const tx = db.transaction(() => {
    for (const p of prepared) upsert.run(p.row)
  })
  tx()
  const finishedAt = new Date().toISOString()
  logQuerySuccess(db, {
    categoryId, keyword, platform: 'wechat',
    startedAt, finishedAt,
    notes: prepared.map((p) => ({
      noteId: p.snap.noteId, hotScore: p.snap.hotScore,
      likes: p.snap.likes, comments: null, views: p.snap.views,
    })),
  })

  return NextResponse.json({ ok: true, saved: prepared.length, total: items.length })
}
