import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db/client'
import { getQueryWithNotes } from '@/lib/db/queries'

export const runtime = 'nodejs'

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params
  const queryId = Number(id)
  if (!Number.isFinite(queryId) || queryId <= 0) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }
  const db = getDb()
  const detail = getQueryWithNotes(db, queryId)
  if (!detail) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(detail)
}
