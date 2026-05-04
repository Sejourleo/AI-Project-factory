import { NextResponse } from 'next/server'
import { db, ensureMigrated } from '@/lib/db/client'
import { listCategories } from '@/lib/db/categories'
import { getLLMClient } from '@/lib/llm/client'
import { runInsightsPipeline } from '@/app/api/insights/generate/route'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const llm = getLLMClient()
  if (!llm) {
    return NextResponse.json({ error: 'LLM not configured' }, { status: 503 })
  }

  await ensureMigrated()
  const categories = await listCategories()

  const yesterday = new Date(Date.now() - 86400_000)
  const yStr = yesterday.toISOString().slice(0, 10)

  type Result = { categoryId: string; categoryName: string; status: 'generated' | 'skipped' | 'error'; detail?: string }
  const results: Result[] = []

  for (const cat of categories) {
    const { rows } = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM collected_notes
       WHERE category_id = $1 AND substr(collected_at, 1, 10) = $2`,
      [cat.id, yStr],
    )
    const count = rows[0]?.n ?? 0

    if (count === 0) {
      results.push({ categoryId: cat.id, categoryName: cat.name, status: 'skipped', detail: `${yStr} 无新数据` })
      continue
    }

    try {
      const r = await runInsightsPipeline(llm, cat.id)
      results.push({
        categoryId: cat.id, categoryName: cat.name, status: 'generated',
        detail: `${r.insightsCount} insights from ${r.sourceCount} notes`,
      })
    } catch (err) {
      results.push({
        categoryId: cat.id, categoryName: cat.name, status: 'error',
        detail: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return NextResponse.json({ date: yStr, results })
}
