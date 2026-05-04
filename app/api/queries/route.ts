import { NextResponse } from 'next/server'
import { listQueries, type QueryStatus } from '@/lib/db/queries'
import { PLATFORMS, type Platform } from '@/lib/types'

export const runtime = 'nodejs'

const VALID_PLATFORMS = new Set<Platform>(PLATFORMS.map((p) => p.id))
const VALID_STATUSES = new Set<QueryStatus>(['success', 'error'])

export async function GET(req: Request) {
  const url = new URL(req.url)
  const categoryId = url.searchParams.get('categoryId')
  if (!categoryId) return NextResponse.json({ error: 'Missing categoryId' }, { status: 400 })

  const platformParam = url.searchParams.get('platform')
  const platform = platformParam && VALID_PLATFORMS.has(platformParam as Platform)
    ? (platformParam as Platform) : undefined

  const statusParam = url.searchParams.get('status')
  const status = statusParam && VALID_STATUSES.has(statusParam as QueryStatus)
    ? (statusParam as QueryStatus) : undefined

  const keywordParam = url.searchParams.get('keyword')?.trim()
  const keyword = keywordParam || undefined

  const limit = Number(url.searchParams.get('limit') ?? 50)
  const cursor = url.searchParams.get('cursor') ?? undefined

  const result = await listQueries({ categoryId, keyword, platform, status, limit, cursor })
  return NextResponse.json(result)
}
