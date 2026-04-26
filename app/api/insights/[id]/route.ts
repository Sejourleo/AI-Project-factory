import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db/client'
import { getInsightSnapshot } from '@/lib/db/insights'

export const runtime = 'nodejs'

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params
  const numId = Number(id)
  if (!Number.isFinite(numId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }
  const db = getDb()
  const snap = getInsightSnapshot(db, numId)
  if (!snap) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(snap)
}
