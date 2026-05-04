import { NextResponse } from 'next/server'
import { getLatestInsightSnapshot } from '@/lib/db/insights'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const categoryId = url.searchParams.get('categoryId')
  if (!categoryId) {
    return NextResponse.json({ error: 'Missing categoryId' }, { status: 400 })
  }
  const snap = await getLatestInsightSnapshot(categoryId)
  return NextResponse.json(snap ?? null)
}
