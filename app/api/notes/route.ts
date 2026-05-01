import { NextResponse } from 'next/server'
import { getDb, type NoteRow } from '@/lib/db/client'
import type { ContentItem, Platform } from '@/lib/types'

export const runtime = 'nodejs'

function rowToContentItem(r: NoteRow): ContentItem {
  let tags: string[] = []
  try {
    tags = JSON.parse(r.tags)
  } catch {
    tags = []
  }
  return {
    id: r.id,
    categoryId: r.category_id,
    platform: r.platform as Platform,
    title: r.title,
    summary: r.summary,
    author: r.author,
    publishedAt: r.published_at,
    collectedAt: r.collected_at,
    url: r.url,
    coverImage: r.cover_image ?? undefined,
    stats: {
      likes: r.likes,
      comments: r.comments ?? undefined,
      shares: r.shares ?? undefined,
      views: r.views,
    },
    hotScore: r.hot_score,
    tags,
    matchedBy: { type: 'keyword', value: r.keyword },
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const categoryId = url.searchParams.get('categoryId')
  const platform = url.searchParams.get('platform')
  const date = url.searchParams.get('date')

  if (!categoryId) {
    return NextResponse.json({ error: 'Missing categoryId' }, { status: 400 })
  }

  const db = getDb()
  const clauses: string[] = ['category_id = ?']
  const params: unknown[] = [categoryId]
  if (platform) {
    clauses.push('platform = ?')
    params.push(platform)
  }
  if (date) {
    clauses.push("substr(published_at, 1, 10) = ?")
    params.push(date)
  }

  const sql = `
    SELECT * FROM collected_notes
    WHERE ${clauses.join(' AND ')}
    ORDER BY hot_score DESC, published_at DESC
    LIMIT 500
  `
  const rows = db.prepare(sql).all(...params) as NoteRow[]
  return NextResponse.json({ items: rows.map(rowToContentItem) })
}
