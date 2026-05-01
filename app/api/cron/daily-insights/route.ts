import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db/client'
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

  const db = getDb()
  const categories = listCategories(db)

  const yesterday = new Date(Date.now() - 86400_000)
  const yStr = yesterday.toISOString().slice(0, 10)

  type Result = { categoryId: string; categoryName: string; status: 'generated' | 'skipped' | 'error'; detail?: string }
  const results: Result[] = []

  for (const cat of categories) {
    const count = (db.prepare(`
      SELECT count(*) as n FROM collected_notes
      WHERE category_id = ? AND substr(collected_at, 1, 10) = ?
    `).get(cat.id, yStr) as { n: number }).n

    if (count === 0) {
      results.push({ categoryId: cat.id, categoryName: cat.name, status: 'skipped', detail: `${yStr} 无新数据` })
      continue
    }

    try {
      const r = await runInsightsPipeline(db, llm, cat.id)
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
