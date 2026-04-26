# 选题分析功能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the 选题分析 page to SiliconFlow LLM, add daily cron auto-analysis, and add per-keyword targeted analysis.

**Architecture:** Reuse the existing two-stage insights pipeline (`stage1` summarize → `stage2` generate insights). Fix the OpenAI client URL construction and add json_schema fallback for SiliconFlow/GLM-5 compatibility. Add a cron GET endpoint that iterates categories and a keyword-filtered POST endpoint. Frontend gets a new Dialog for keyword selection.

**Tech Stack:** Next.js 16 App Router, better-sqlite3, OpenAI-compatible chat/completions API (SiliconFlow), React 19, Base UI Dialog, Tailwind CSS, lucide-react icons.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `.env.local` | Modify | Point LLM config to SiliconFlow |
| `lib/llm/openai.ts` | Modify | Fix URL path, add json_schema fallback |
| `app/api/insights/generate/route.ts` | Modify | Export `pickNotesByKeywords`, export `stage1` |
| `app/api/insights/generate-by-keyword/route.ts` | Create | Keyword-filtered insight generation endpoint |
| `app/api/cron/daily-insights/route.ts` | Create | Daily cron endpoint |
| `lib/data/reports.ts` | Modify | Add `generateByKeyword` client function |
| `components/keyword-analysis-dialog.tsx` | Create | Dialog for keyword selection + analysis trigger |
| `components/report-viewer.tsx` | Modify | Add 定向分析 button |

---

### Task 1: Fix OpenAI client URL and add json_schema fallback

**Files:**
- Modify: `lib/llm/openai.ts`

- [ ] **Step 1: Fix URL construction**

The current code builds `${baseUrl}/v1/chat/completions` but SiliconFlow's base_url is already `https://api.siliconflow.cn/v1`. Change line 14 to strip a trailing `/v1` or `/v1/` before appending `/chat/completions`:

```typescript
const url = `${opts.baseUrl.replace(/\/+$/, '')}/chat/completions`
```

- [ ] **Step 2: Add fallback for models that don't support json_schema strict mode**

Wrap the fetch in a try-first-then-fallback pattern. Track whether fallback is needed with a closure variable so subsequent calls skip the failing path. Replace the entire `generateStructured` method body:

```typescript
let useJsonObjectFallback = false

async generateStructured<T>(args: {
  system: string; user: string
  schema: Record<string, unknown>; schemaName: string
  maxTokens?: number
  signal?: AbortSignal
}): Promise<T> {
  const url = `${opts.baseUrl.replace(/\/+$/, '')}/chat/completions`
  const signal = args.signal ?? AbortSignal.timeout(120_000)
  const headers = {
    Authorization: `Bearer ${opts.apiKey}`,
    'Content-Type': 'application/json',
  }

  async function doFetch(useJsonObject: boolean): Promise<T> {
    const systemContent = useJsonObject
      ? args.system + '\n\n请严格按以下 JSON Schema 输出，不要输出任何其他内容：\n' + JSON.stringify(args.schema, null, 2)
      : args.system
    const responseFormat = useJsonObject
      ? { type: 'json_object' as const }
      : { type: 'json_schema' as const, json_schema: { name: args.schemaName, schema: args.schema, strict: true } }

    const res = await fetch(url, {
      method: 'POST', signal, headers,
      body: JSON.stringify({
        model: opts.model,
        messages: [
          { role: 'system', content: systemContent },
          { role: 'user', content: args.user },
        ],
        response_format: responseFormat,
        max_tokens: args.maxTokens ?? 4096,
      }),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new Error(`OpenAI HTTP ${res.status}: ${detail.slice(0, 300)}`)
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = json.choices?.[0]?.message?.content
    if (!content) throw new Error('OpenAI: empty content')
    return JSON.parse(content) as T
  }

  if (useJsonObjectFallback) {
    return doFetch(true)
  }
  try {
    return await doFetch(false)
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    if (msg.includes('HTTP 4')) {
      console.warn('[llm] json_schema not supported, falling back to json_object')
      useJsonObjectFallback = true
      return doFetch(true)
    }
    throw err
  }
}
```

- [ ] **Step 3: Update .env.local**

Replace the LLM config block in `.env.local`:

```
LLM_PROVIDER=openai
LLM_BASE_URL=https://api.siliconflow.cn/v1
LLM_API_KEY=sk-kvxozdtvpjpejicxrukunlchvdvorfxvakmfhtyrehcpftop
LLM_MODEL=zai-org/GLM-5
```

- [ ] **Step 4: Verify the app still builds**

Run: `npx next build 2>&1 | tail -20`
Expected: Build succeeds (or only pre-existing warnings).

- [ ] **Step 5: Commit**

```bash
git add lib/llm/openai.ts .env.local
git commit -m "fix(llm): SiliconFlow-compatible URL + json_schema fallback"
```

---

### Task 2: Export shared pipeline functions for reuse

**Files:**
- Modify: `app/api/insights/generate/route.ts`

The `pickTopNotes`, `stage1`, and `TopNote` type are currently private to this file. We need to export them so the keyword-filtered endpoint and cron endpoint can reuse them.

- [ ] **Step 1: Export TopNote type, stage1, and add pickNotesByKeywords**

Add `export` to the `TopNote` type (line 21) and `stage1` function (line 41):

```typescript
export type TopNote = {
  id: string; platform: Platform; title: string; author: string
  summary: string; raw: string; hotScore: number
}
```

```typescript
export async function stage1(
```

Add a new exported function after `pickTopNotes` (after line 39):

```typescript
export function pickNotesByKeywords(
  db: Database.Database, categoryId: string, keywords: string[], limit = 15
): TopNote[] {
  if (keywords.length === 0) return []
  const likeClauses = keywords.map(() => '(keyword = ? OR title LIKE ? OR summary LIKE ?)').join(' OR ')
  const params: unknown[] = [categoryId]
  for (const kw of keywords) {
    params.push(kw, `%${kw}%`, `%${kw}%`)
  }
  const rows = db.prepare(`
    SELECT * FROM collected_notes
    WHERE category_id = ? AND (${likeClauses})
    ORDER BY hot_score DESC, published_at DESC
    LIMIT ?
  `).all(...params, limit) as NoteRow[]
  return rows.map((r) => ({
    id: r.id, platform: r.platform as Platform,
    title: r.title, author: r.author, summary: r.summary,
    raw: r.raw, hotScore: r.hot_score,
  }))
}
```

- [ ] **Step 2: Verify build**

Run: `npx next build 2>&1 | tail -20`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add app/api/insights/generate/route.ts
git commit -m "refactor(insights): export stage1, TopNote, add pickNotesByKeywords"
```

---

### Task 3: Create keyword-filtered insight generation endpoint

**Files:**
- Create: `app/api/insights/generate-by-keyword/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
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
    return NextResponse.json(
      { error: 'LLM not configured' }, { status: 503 }
    )
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
```

- [ ] **Step 2: Verify build**

Run: `npx next build 2>&1 | tail -20`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add app/api/insights/generate-by-keyword/route.ts
git commit -m "feat(api): keyword-filtered insight generation endpoint"
```

---

### Task 4: Create daily cron endpoint

**Files:**
- Create: `app/api/cron/daily-insights/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
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
```

- [ ] **Step 2: Verify build**

Run: `npx next build 2>&1 | tail -20`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add app/api/cron/daily-insights/route.ts
git commit -m "feat(api): daily cron endpoint for auto insight generation"
```

---

### Task 5: Add client-side `generateByKeyword` function

**Files:**
- Modify: `lib/data/reports.ts`

- [ ] **Step 1: Add the function at the end of the file**

Append after the existing `regenerateInsight` function (after line 146):

```typescript
export async function generateByKeyword(
  categoryId: string,
  keywords: string[]
): Promise<{
  ok: boolean
  snapshotId?: number
  insightsCount?: number
  sourceCount?: number
  error?: string
}> {
  const res = await fetch('/api/insights/generate-by-keyword', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ categoryId, keywords }),
  })
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    return {
      ok: false,
      error: (body.error as string) ?? `HTTP ${res.status}`,
    }
  }
  return {
    ok: true,
    snapshotId: body.snapshotId as number,
    insightsCount: body.insightsCount as number,
    sourceCount: body.sourceCount as number,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/data/reports.ts
git commit -m "feat(data): add generateByKeyword client function"
```

---

### Task 6: Create KeywordAnalysisDialog component

**Files:**
- Create: `components/keyword-analysis-dialog.tsx`

This dialog lets users pick from configured keywords and/or type custom ones, then triggers the keyword-filtered analysis.

- [ ] **Step 1: Create the component file**

```tsx
'use client'

import { useState } from 'react'
import { Search, Plus, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader,
  DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { generateByKeyword } from '@/lib/data/reports'
import { cn } from '@/lib/utils'

export function KeywordAnalysisDialog({
  categoryId,
  configuredKeywords,
  onGenerated,
}: {
  categoryId: string
  configuredKeywords: string[]
  onGenerated: () => void
}) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [customInput, setCustomInput] = useState('')
  const [customKeywords, setCustomKeywords] = useState<string[]>([])
  const [analyzing, setAnalyzing] = useState(false)

  function reset() {
    setSelected(new Set())
    setCustomInput('')
    setCustomKeywords([])
  }

  function toggleKeyword(kw: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(kw)) next.delete(kw)
      else next.add(kw)
      return next
    })
  }

  function addCustom() {
    const v = customInput.trim()
    if (!v) return
    if (selected.has(v) || customKeywords.includes(v)) return
    setCustomKeywords((prev) => [...prev, v])
    setSelected((prev) => new Set(prev).add(v))
    setCustomInput('')
  }

  function removeCustom(kw: string) {
    setCustomKeywords((prev) => prev.filter((k) => k !== kw))
    setSelected((prev) => {
      const next = new Set(prev)
      next.delete(kw)
      return next
    })
  }

  const allSelected = Array.from(selected)

  async function handleAnalyze() {
    if (allSelected.length === 0) return
    setAnalyzing(true)
    const r = await generateByKeyword(categoryId, allSelected)
    setAnalyzing(false)
    if (!r.ok) {
      toast.error(`分析失败：${r.error}`)
      return
    }
    toast.success(`已生成 ${r.insightsCount} 条洞察（基于 ${r.sourceCount} 篇笔记）`)
    setOpen(false)
    reset()
    onGenerated()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => { setOpen(v); if (!v) reset() }}
    >
      <DialogTrigger
        render={
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-neutral-100 text-neutral-700 hover:bg-neutral-200/70 transition-colors" />
        }
      >
        <Search size={13} />
        定向分析
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>定向关键词分析</DialogTitle>
          <DialogDescription>
            选择或输入关键词，针对性地生成选题洞察
          </DialogDescription>
        </DialogHeader>

        {configuredKeywords.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-neutral-500">已配置的关键词</p>
            <div className="flex flex-wrap gap-1.5">
              {configuredKeywords.map((kw) => (
                <button
                  key={kw}
                  onClick={() => toggleKeyword(kw)}
                  className={cn(
                    'px-2.5 py-1 text-xs rounded-md border transition-colors',
                    selected.has(kw)
                      ? 'bg-neutral-900 text-white border-neutral-900'
                      : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'
                  )}
                >
                  {kw}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs text-neutral-500">自定义关键词</p>
          <div className="flex gap-2">
            <Input
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom() } }}
              placeholder="输入关键词按回车添加"
              className="text-sm"
            />
            <Button variant="outline" size="sm" onClick={addCustom} disabled={!customInput.trim()}>
              <Plus size={14} />
            </Button>
          </div>
          {customKeywords.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {customKeywords.map((kw) => (
                <span
                  key={kw}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-blue-50 text-blue-700 border border-blue-200"
                >
                  {kw}
                  <button onClick={() => removeCustom(kw)} className="hover:text-blue-900">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={handleAnalyze}
            disabled={allSelected.length === 0 || analyzing}
            className={cn(analyzing && 'cursor-wait')}
          >
            {analyzing
              ? <><Loader2 size={14} className="animate-spin mr-1.5" />分析中…</>
              : <>开始分析（{allSelected.length} 个关键词）</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npx next build 2>&1 | tail -20`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add components/keyword-analysis-dialog.tsx
git commit -m "feat(ui): KeywordAnalysisDialog component"
```

---

### Task 7: Wire KeywordAnalysisDialog into ReportViewer

**Files:**
- Modify: `components/report-viewer.tsx`

- [ ] **Step 1: Add import and props**

Add import at the top of the file (after line 9):

```typescript
import { KeywordAnalysisDialog } from '@/components/keyword-analysis-dialog'
```

Add `configuredKeywords` to the component props. Change the props type (lines 12-18):

```typescript
export function ReportViewer({
  categoryId,
  snapshot,
  loading,
  onRegenerated,
  configuredKeywords = [],
}: {
  categoryId: string
  snapshot: InsightSnapshot | null
  loading: boolean
  onRegenerated: () => void
  configuredKeywords?: string[]
}) {
```

- [ ] **Step 2: Add the dialog button in the empty state**

In the `!snapshot` block (around line 50), add the dialog button after the existing 生成洞察 button, inside the same flex container:

```tsx
if (!snapshot) {
    return (
      <div className="bg-white rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] p-12 flex flex-col items-center gap-4">
        <Sparkles size={28} className="text-neutral-300" />
        <p className="text-sm text-neutral-500">该分类暂无 AI 洞察</p>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 transition-colors',
              regenerating && 'cursor-wait opacity-60'
            )}
          >
            {regenerating
              ? <Loader2 size={13} className="animate-spin" />
              : <Sparkles size={13} />}
            {regenerating ? '生成中…' : '生成洞察'}
          </button>
          <KeywordAnalysisDialog
            categoryId={categoryId}
            configuredKeywords={configuredKeywords}
            onGenerated={onRegenerated}
          />
        </div>
      </div>
    )
  }
```

- [ ] **Step 3: Add the dialog button in the header of the success state**

In the success state header (around line 101-111), add the dialog next to the 重新生成 button. Replace the single button with a flex container:

```tsx
<div className="flex items-center gap-2 shrink-0">
  <KeywordAnalysisDialog
    categoryId={categoryId}
    configuredKeywords={configuredKeywords}
    onGenerated={onRegenerated}
  />
  <button
    onClick={handleRegenerate}
    disabled={regenerating}
    className={cn(
      'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-neutral-100 text-neutral-700 hover:bg-neutral-200/70 transition-colors',
      regenerating && 'cursor-wait opacity-60'
    )}
  >
    <RefreshCw size={13} className={regenerating ? 'animate-spin' : ''} />
    {regenerating ? '分析中…' : '重新生成'}
  </button>
</div>
```

- [ ] **Step 4: Verify build**

Run: `npx next build 2>&1 | tail -20`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add components/report-viewer.tsx
git commit -m "feat(ui): wire KeywordAnalysisDialog into ReportViewer"
```

---

### Task 8: Pass configuredKeywords from the reports page

**Files:**
- Modify: `app/c/[categoryId]/reports/page.tsx`

- [ ] **Step 1: Import useCategories and pass keywords to ReportViewer**

Add import at the top:

```typescript
import { useCategories } from '@/components/categories-provider'
```

Inside the component body, after the existing state declarations (after line 27), add:

```typescript
const { getById } = useCategories()
const category = getById(categoryId)
const configuredKeywords = (category?.settings.keywords ?? []).map((k) => k.value)
```

Update the `<ReportViewer>` call (around line 67-72) to pass the new prop:

```tsx
<ReportViewer
  categoryId={categoryId}
  snapshot={snapshot}
  loading={loading}
  onRegenerated={() => setRefreshKey((k) => k + 1)}
  configuredKeywords={configuredKeywords}
/>
```

- [ ] **Step 2: Verify build**

Run: `npx next build 2>&1 | tail -20`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add app/c/[categoryId]/reports/page.tsx
git commit -m "feat(ui): pass configured keywords to ReportViewer"
```

---

### Task 9: Manual smoke test

- [ ] **Step 1: Start dev server and test the reports page**

Run: `npm run dev` (user runs manually)

1. Navigate to any category's 选题分析 tab
2. Verify the 「定向分析」button appears next to 「重新生成」
3. Click 「定向分析」— verify the dialog opens with configured keywords as chips
4. Type a custom keyword and press Enter — verify it appears as a blue chip
5. Select some keywords and click 「开始分析」— verify loading state shows
6. If there's data in the DB, verify insights are generated and displayed after completion
7. If no data, verify the error toast shows "未找到匹配的笔记数据"

- [ ] **Step 2: Test the cron endpoint**

Run: `curl http://localhost:3000/api/cron/daily-insights`

Verify it returns JSON with `{ date, results }` where each category shows `skipped` (if no yesterday data) or `generated`.

- [ ] **Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: smoke test fixes"
```
