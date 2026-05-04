import { NextResponse } from 'next/server'
import { db, ensureMigrated, type NoteRow } from '@/lib/db/client'
import type { ContentItem, Platform } from '@/lib/types'

export const runtime = 'nodejs'

function rowToContentItem(r: NoteRow): ContentItem {
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
    tags: r.tags ?? [],
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

  await ensureMigrated()

  const clauses: string[] = ['category_id = $1']
  const params: unknown[] = [categoryId]
  if (platform) {
    params.push(platform)
    clauses.push(`platform = $${params.length}`)
  }
  if (date) {
    params.push(date)
    clauses.push(`substr(published_at, 1, 10) = $${params.length}`)
  }

  const text = `
    SELECT * FROM collected_notes
    WHERE ${clauses.join(' AND ')}
    ORDER BY hot_score DESC, published_at DESC
    LIMIT 500
  `
  const { rows } = await db.query<NoteRow>(text, params)
  return NextResponse.json({ items: rows.map(rowToContentItem) })
}
