import type Database from 'better-sqlite3'
import { NextResponse } from 'next/server'
import { getDb, type NoteRow } from '@/lib/db/client'
import { getCategoryById } from '@/lib/db/categories'
import {
  upsertNoteSummary, getNoteSummaries, insertInsightSnapshot,
} from '@/lib/db/insights'
import { getLLMClient, type LLMClient } from '@/lib/llm/client'
import {
  NOTE_SUMMARY_SCHEMA, INSIGHTS_SCHEMA,
  buildNoteSummaryPrompt, buildInsightsPrompt,
} from '@/lib/llm/prompts'
import type { NoteSummary, TopicInsight, Platform } from '@/lib/types'

export const runtime = 'nodejs'

const TOP_N = 10
const WINDOW_DAYS = 7
const STAGE1_CONCURRENCY = 5

type TopNote = {
  id: string; platform: Platform; title: string; author: string
  summary: string; raw: string; hotScore: number
}

function pickTopNotes(db: Database.Database, categoryId: string): TopNote[] {
  const since = new Date(Date.now() - WINDOW_DAYS * 86400_000).toISOString()
  const rows = db.prepare(`
    SELECT * FROM collected_notes
    WHERE category_id = ? AND collected_at >= ?
    ORDER BY hot_score DESC, published_at DESC
    LIMIT ?
  `).all(categoryId, since, TOP_N) as NoteRow[]
  return rows.map((r) => ({
    id: r.id, platform: r.platform as Platform,
    title: r.title, author: r.author, summary: r.summary,
    raw: r.raw, hotScore: r.hot_score,
  }))
}

async function stage1(
  db: Database.Database, llm: LLMClient, notes: TopNote[]
): Promise<NoteSummary[]> {
  const cached = getNoteSummaries(db, notes.map((n) => n.id))
  const todo = notes.filter((n) => !cached.has(n.id))
  const results: NoteSummary[] = []
  for (let i = 0; i < todo.length; i += STAGE1_CONCURRENCY) {
    const batch = todo.slice(i, i + STAGE1_CONCURRENCY)
    const settled = await Promise.allSettled(batch.map(async (n) => {
      const { system, user } = buildNoteSummaryPrompt(n)
      const out = await llm.generateStructured<{
        summary: string; keywords: string[]
        keyPoints: string[]; highlights: string[]
        audience?: string
      }>({
        system, user, schema: NOTE_SUMMARY_SCHEMA, schemaName: 'NoteSummary',
      })
      const summary: NoteSummary = {
        noteId: n.id, summary: out.summary,
        keywords: out.keywords, keyPoints: out.keyPoints,
        highlights: out.highlights, audience: out.audience,
      }
      upsertNoteSummary(db, { ...summary, model: llm.modelId })
      return summary
    }))
    for (const r of settled) {
      if (r.status === 'fulfilled') results.push(r.value)
      else console.warn('[insights] stage1 note failed:', r.reason)
    }
  }
  for (const [, s] of cached) results.push(s)
  return results
}

export async function runInsightsPipeline(
  db: Database.Database, llm: LLMClient, categoryId: string
): Promise<{ snapshotId: number; insightsCount: number; sourceCount: number; generatedAt: string }> {
  const cat = getCategoryById(db, categoryId)
  if (!cat) throw new Error(`Category ${categoryId} not found`)
  const generatedAt = new Date().toISOString()

  const top = pickTopNotes(db, categoryId)
  const summaries = await stage1(db, llm, top)
  const summaryByNote = new Map(summaries.map((s) => [s.noteId, s]))
  const noteMeta = new Map(top.map((n) => [n.id, n]))

  const stage2Input = summaries.map((s) => {
    const m = noteMeta.get(s.noteId)
    return {
      noteId: s.noteId,
      title: m?.title ?? '',
      hotScore: m?.hotScore ?? 0,
      platform: m?.platform ?? 'xiaohongshu',
      summary: s.summary,
      keywords: s.keywords,
      keyPoints: s.keyPoints,
      highlights: s.highlights,
      audience: s.audience,
    }
  })
  const { system, user } = buildInsightsPrompt({
    categoryName: cat.name, summaries: stage2Input,
  })

  let insights: TopicInsight[]
  try {
    const out = await llm.generateStructured<{ insights: TopicInsight[] }>({
      system, user, schema: INSIGHTS_SCHEMA, schemaName: 'TopicInsights',
      maxTokens: 4096,
    })
    insights = out.insights ?? []
  } catch (err) {
    insertInsightSnapshot(db, {
      categoryId, generatedAt, status: 'error',
      errorMessage: err instanceof Error ? err.message : String(err),
      sourceNoteIds: summaries.map((s) => s.noteId),
      insights: [], model: llm.modelId,
    })
    throw err
  }

  const snapshotId = insertInsightSnapshot(db, {
    categoryId, generatedAt, status: 'success',
    sourceNoteIds: summaries.map((s) => s.noteId),
    insights, model: llm.modelId,
  })
  // suppress unused warning when summaryByNote is read by tools
  void summaryByNote
  return {
    snapshotId, insightsCount: insights.length,
    sourceCount: summaries.length, generatedAt,
  }
}

export async function POST(req: Request) {
  const llm = getLLMClient()
  if (!llm) {
    return NextResponse.json(
      { error: 'LLM not configured (set LLM_PROVIDER/LLM_BASE_URL/LLM_API_KEY/LLM_MODEL)' },
      { status: 503 }
    )
  }
  let body: { categoryId?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const categoryId = (body.categoryId ?? '').trim()
  if (!categoryId) return NextResponse.json({ error: 'Missing categoryId' }, { status: 400 })
  const db = getDb()
  if (!getCategoryById(db, categoryId)) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 })
  }
  try {
    const result = await runInsightsPipeline(db, llm, categoryId)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: 'LLM pipeline failed', detail: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    )
  }
}
