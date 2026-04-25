import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db/client'
import { getCategoryById, replaceKeywords } from '@/lib/db/categories'
import { PLATFORMS, type KeywordConfig, type Platform } from '@/lib/types'

export const runtime = 'nodejs'

const VALID_PLATFORMS = new Set<Platform>(PLATFORMS.map((p) => p.id))

function isKeywordConfig(x: unknown): x is KeywordConfig {
  if (!x || typeof x !== 'object') return false
  const k = x as Record<string, unknown>
  if (typeof k.value !== 'string' || !k.value.trim()) return false
  if (!Array.isArray(k.platforms)) return false
  return k.platforms.every((p) => typeof p === 'string' && VALID_PLATFORMS.has(p as Platform))
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params
  let body: { keywords?: unknown }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (!Array.isArray(body.keywords) || !body.keywords.every(isKeywordConfig)) {
    return NextResponse.json({ error: 'Invalid keywords' }, { status: 400 })
  }
  const db = getDb()
  if (!getCategoryById(db, id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  replaceKeywords(db, id, body.keywords as KeywordConfig[])
  return NextResponse.json({ category: getCategoryById(db, id) })
}
