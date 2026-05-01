import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db/client'
import { getCategoryById } from '@/lib/db/categories'
import { insertInsightSnapshot } from '@/lib/db/insights'
import { getLLMClient } from '@/lib/llm/client'
import { INSIGHTS_SCHEMA, buildInsightsPrompt } from '@/lib/llm/prompts'
import { stage1, pickNotesByKeywords } from '@/app/api/insights/generate/route'
import type { TopicInsight } from '@/lib/types'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const llm = getLLMClient()
  if (!llm) {
    return NextResponse.json({ error: 'LLM not configured' }, { status: 503 })
  }
  let body: { categoryId?: string; keywords?: string[] }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const categoryId = (body.categoryId ?? '').trim()
  const keywords = (body.keywords ?? []).map((k: string) => k.trim()).filter(Boolean)
  if (!categoryId) return NextResponse.json({ error: 'Missing categoryId' }, { status: 400 })
  if (keywords.length === 0) return NextResponse.json({ error: 'Missing keywords' }, { status: 400 })

  const db = getDb()
  const cat = getCategoryById(db, categoryId)
  if (!cat) return NextResponse.json({ error: 'Category not found' }, { status: 404 })

  const generatedAt = new Date().toISOString()
  const notes = pickNotesByKeywords(db, categoryId, keywords)
  if (notes.length === 0) {
    return NextResponse.json({ error: '未找到匹配的笔记数据', keywords }, { status: 404 })
  }

  try {
    const summaries = await stage1(db, llm, notes)
    const noteMeta = new Map(notes.map((n) => [n.id, n]))
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
      categoryName: `${cat.name}（聚焦关键词：${keywords.join('、')}）`,
      summaries: stage2Input,
    })
    const out = await llm.generateStructured<{ insights: TopicInsight[] }>({
      system, user, schema: INSIGHTS_SCHEMA, schemaName: 'TopicInsights',
      maxTokens: 4096,
    })
    const insights = out.insights ?? []
    const snapshotId = insertInsightSnapshot(db, {
      categoryId, generatedAt, status: 'success',
      sourceNoteIds: summaries.map((s) => s.noteId),
      insights, model: llm.modelId,
    })
    return NextResponse.json({
      snapshotId, insightsCount: insights.length,
      sourceCount: summaries.length, generatedAt, keywords,
    })
  } catch (err) {
    insertInsightSnapshot(db, {
      categoryId, generatedAt, status: 'error',
      errorMessage: err instanceof Error ? err.message : String(err),
      sourceNoteIds: [], insights: [], model: llm.modelId,
    })
    return NextResponse.json(
      { error: 'LLM pipeline failed', detail: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    )
  }
}
