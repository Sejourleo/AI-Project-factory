import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db/client'
import { listInsightSnapshots } from '@/lib/db/insights'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const categoryId = url.searchParams.get('categoryId')
  if (!categoryId) {
    return NextResponse.json({ error: 'Missing categoryId' }, { status: 400 })
  }
  const limit = Number(url.searchParams.get('limit') ?? 20)
  const cursor = url.searchParams.get('cursor') ?? undefined
  const db = getDb()
  const r = listInsightSnapshots(db, { categoryId, limit, cursor })
  return NextResponse.json({
    items: r.items.map((s) => ({
      id: s.id, generatedAt: s.generatedAt, status: s.status,
      errorMessage: s.errorMessage, model: s.model,
      insightsCount: s.insights.length,
      sourceCount: s.sourceNoteIds.length,
    })),
    nextCursor: r.nextCursor,
  })
}
