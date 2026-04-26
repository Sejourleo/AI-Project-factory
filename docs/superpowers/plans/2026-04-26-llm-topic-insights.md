# LLM 选题洞察 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用两阶段 LLM 管线（per-article 摘要 → 聚合洞察）替换 fixture-only 选题分析，输出 ≥5 条结构化 `TopicInsight`。

**Architecture:** 新增 `note_summaries`（按 note_id 永久缓存）+ `topic_insights`（按 category 历史快照）两张表；新增 provider-agnostic LLM 客户端（OpenAI-compatible + Anthropic 双路径）；新增 `/api/insights/*` 接口；改写 `app/c/[categoryId]/reports` 页与 `report-viewer.tsx` 渲染；保留 `TopicSuggestion` 类型不删。

**Tech Stack:** Next.js 15 App Router, better-sqlite3, fetch-based LLM 调用 (OpenAI `response_format: json_schema` + Anthropic tool use), Vitest + 内存 SQLite, TypeScript strict。

**关联 spec:** `docs/superpowers/specs/2026-04-25-llm-topic-insights-design.md`

---

## File Structure

**新建：**
- `lib/llm/client.ts` — `LLMClient` 接口 + `getLLMClient()` factory
- `lib/llm/openai.ts` — OpenAI-compatible provider 实现
- `lib/llm/anthropic.ts` — Anthropic 原生 provider 实现
- `lib/llm/prompts.ts` — Stage 1/2 prompt 模板 + JSON schemas
- `lib/db/insights.ts` — `note_summaries` / `topic_insights` CRUD
- `app/api/insights/generate/route.ts` — POST 触发管线
- `app/api/insights/latest/route.ts` — GET 最新快照
- `app/api/insights/route.ts` — GET 历史快照列表
- `app/api/insights/[id]/route.ts` — GET 指定快照详情
- `components/insight-card.tsx` — 渲染 `TopicInsight`
- 测试: `tests/db/insights.test.ts`, `tests/llm/openai.test.ts`, `tests/llm/anthropic.test.ts`, `tests/api/insights-generate.test.ts`

**修改：**
- `lib/db/client.ts` — `applyMigrations` 加两张表
- `lib/types.ts` — 新增 `NoteSummary` / `TopicInsight` / `InsightSnapshot`
- `lib/data/reports.ts` — 加 `getLatestInsight` / `listInsightSnapshots` / `getInsightSnapshot` / `regenerateInsight`
- `app/c/[categoryId]/reports/page.tsx` — 两个 tab 改名 + 切数据源
- `components/report-viewer.tsx` — 用 `InsightCard` 替换 `TopicCard`,接 `regenerateInsight`
- `components/topics-aggregate-view.tsx` — 改为列历史快照
- `.env.local.example` — 加 LLM 环境变量示例

**保留不动：** `components/topic-card.tsx`, `lib/fixtures/reports.ts`（向后兼容）。

---

## Task 1: DB schema — `note_summaries` + `topic_insights`

**Files:**
- Modify: `lib/db/client.ts`(在 `applyMigrations` 末尾追加两张表)

- [ ] **Step 1: 写失败的测试**

新建 `tests/db/insights-schema.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { applyMigrations } from '@/lib/db/client'

let db: Database.Database

beforeEach(() => {
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  applyMigrations(db)
})

describe('insights schema', () => {
  it('note_summaries 表存在,FK 级联删除', () => {
    db.prepare(`INSERT INTO categories (id, name, color, created_at)
                VALUES ('c1', 'C', '#000', '2026-04-26')`).run()
    db.prepare(`
      INSERT INTO collected_notes
        (id, category_id, platform, keyword, title, summary, author, url,
         published_at, collected_at)
      VALUES ('n1', 'c1', 'xiaohongshu', 'kw', 'T', 'S', 'A', 'http://x',
              '2026-04-26', '2026-04-26')
    `).run()
    db.prepare(`
      INSERT INTO note_summaries
        (note_id, summary, keywords, key_points, highlights, audience, model, created_at)
      VALUES ('n1', 's', '[]', '[]', '[]', NULL, 'm', '2026-04-26')
    `).run()
    db.prepare(`DELETE FROM collected_notes WHERE id = 'n1'`).run()
    const row = db.prepare(`SELECT * FROM note_summaries WHERE note_id = 'n1'`).get()
    expect(row).toBeUndefined()
  })

  it('topic_insights 表存在,FK 级联,索引可用', () => {
    db.prepare(`INSERT INTO categories (id, name, color, created_at)
                VALUES ('c1', 'C', '#000', '2026-04-26')`).run()
    const info = db.prepare(`
      INSERT INTO topic_insights
        (category_id, generated_at, status, source_note_ids, insights, model)
      VALUES ('c1', '2026-04-26T10:00:00Z', 'success', '["n1"]', '[]', 'm')
    `).run()
    expect(info.lastInsertRowid).toBeTypeOf('number')
    db.prepare(`DELETE FROM categories WHERE id = 'c1'`).run()
    const row = db.prepare(`SELECT * FROM topic_insights WHERE id = ?`).get(info.lastInsertRowid)
    expect(row).toBeUndefined()
  })
})
```

- [ ] **Step 2: 跑测试,确认 FAIL**

```
npx vitest run tests/db/insights-schema.test.ts
```

期望: `no such table: note_summaries`(或 topic_insights)。

- [ ] **Step 3: 在 `lib/db/client.ts` 的 `applyMigrations` 末尾追加 schema**

在 `applyMigrations` 函数 `db.exec(\`...\`)` 的字符串末尾(`idx_query_notes_note` 索引之后,反引号之前)追加:

```sql

    CREATE TABLE IF NOT EXISTS note_summaries (
      note_id TEXT PRIMARY KEY REFERENCES collected_notes(id) ON DELETE CASCADE,
      summary TEXT NOT NULL,
      keywords TEXT NOT NULL DEFAULT '[]',
      key_points TEXT NOT NULL DEFAULT '[]',
      highlights TEXT NOT NULL DEFAULT '[]',
      audience TEXT,
      model TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS topic_insights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      generated_at TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('success','error')),
      error_message TEXT,
      source_note_ids TEXT NOT NULL DEFAULT '[]',
      insights TEXT NOT NULL DEFAULT '[]',
      model TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_topic_insights_cat_time
      ON topic_insights(category_id, generated_at DESC);
```

- [ ] **Step 4: 跑测试,确认 PASS**

```
npx vitest run tests/db/insights-schema.test.ts
```

- [ ] **Step 5: 提交**

```bash
git add lib/db/client.ts tests/db/insights-schema.test.ts
git commit -m "feat(db): add note_summaries + topic_insights tables"
```

---

## Task 2: 类型 + DB 层 (`lib/db/insights.ts`)

**Files:**
- Modify: `lib/types.ts`
- Create: `lib/db/insights.ts`
- Test: `tests/db/insights.test.ts`

- [ ] **Step 1: 在 `lib/types.ts` 末尾追加类型**

```ts
export type NoteSummary = {
  noteId: string
  summary: string
  keywords: string[]
  keyPoints: string[]
  highlights: string[]
  audience?: string
}

export type TopicInsight = {
  title: string
  angle: string
  evidenceNoteIds: string[]
  audience: string
  contentFormat: string
  differentiation: string
  tags: string[]
}

export type InsightSnapshot = {
  id: number
  categoryId: string
  generatedAt: string
  status: 'success' | 'error'
  errorMessage?: string
  sourceNoteIds: string[]
  insights: TopicInsight[]
  model: string
}
```

- [ ] **Step 2: 写失败测试**

新建 `tests/db/insights.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { applyMigrations } from '@/lib/db/client'
import { createCategory } from '@/lib/db/categories'
import {
  upsertNoteSummary, getNoteSummaries,
  insertInsightSnapshot, getInsightSnapshot,
  getLatestInsightSnapshot, listInsightSnapshots,
} from '@/lib/db/insights'

let db: Database.Database

beforeEach(() => {
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  applyMigrations(db)
})

function seedNote(id: string, categoryId: string) {
  db.prepare(`
    INSERT INTO collected_notes
      (id, category_id, platform, keyword, title, summary, author, url,
       published_at, collected_at)
    VALUES (?, ?, 'xiaohongshu', 'kw', 'T', 'S', 'A', 'http://x',
            '2026-04-26', '2026-04-26')
  `).run(id, categoryId)
}

describe('insights DB', () => {
  it('upsertNoteSummary 永久缓存,二次插入忽略', () => {
    const c = createCategory(db, { name: 'C' })
    seedNote('n1', c.id)
    upsertNoteSummary(db, {
      noteId: 'n1', summary: 'first',
      keywords: ['a'], keyPoints: ['kp'], highlights: ['h'],
      audience: 'devs', model: 'm1',
    })
    upsertNoteSummary(db, {
      noteId: 'n1', summary: 'second',  // 应被忽略
      keywords: [], keyPoints: [], highlights: [],
      model: 'm2',
    })
    const map = getNoteSummaries(db, ['n1'])
    expect(map.get('n1')?.summary).toBe('first')
    expect(map.get('n1')?.keywords).toEqual(['a'])
  })

  it('getNoteSummaries 仅返回命中行,顺序不保证', () => {
    const c = createCategory(db, { name: 'C' })
    seedNote('n1', c.id); seedNote('n2', c.id)
    upsertNoteSummary(db, {
      noteId: 'n1', summary: 's', keywords: [], keyPoints: [],
      highlights: [], model: 'm',
    })
    const map = getNoteSummaries(db, ['n1', 'n2', 'n3'])
    expect(map.size).toBe(1)
    expect(map.has('n1')).toBe(true)
  })

  it('insertInsightSnapshot + getLatestInsightSnapshot', () => {
    const c = createCategory(db, { name: 'C' })
    const id1 = insertInsightSnapshot(db, {
      categoryId: c.id, generatedAt: '2026-04-26T10:00:00Z',
      status: 'success', sourceNoteIds: ['n1', 'n2'],
      insights: [{
        title: 'T', angle: 'A', evidenceNoteIds: ['n1'],
        audience: 'aud', contentFormat: 'fmt',
        differentiation: 'diff', tags: ['x'],
      }],
      model: 'm',
    })
    const id2 = insertInsightSnapshot(db, {
      categoryId: c.id, generatedAt: '2026-04-26T11:00:00Z',
      status: 'success', sourceNoteIds: [], insights: [], model: 'm',
    })
    expect(id2).toBeGreaterThan(id1)
    const latest = getLatestInsightSnapshot(db, c.id)!
    expect(latest.id).toBe(id2)
    const fetched = getInsightSnapshot(db, id1)!
    expect(fetched.insights[0].title).toBe('T')
    expect(fetched.sourceNoteIds).toEqual(['n1', 'n2'])
  })

  it('listInsightSnapshots 倒序 + 翻页', () => {
    const c = createCategory(db, { name: 'C' })
    for (let i = 0; i < 3; i++) {
      insertInsightSnapshot(db, {
        categoryId: c.id,
        generatedAt: `2026-04-26T1${i}:00:00Z`,
        status: 'success', sourceNoteIds: [], insights: [], model: 'm',
      })
    }
    const page1 = listInsightSnapshots(db, { categoryId: c.id, limit: 2 })
    expect(page1.items).toHaveLength(2)
    expect(page1.items[0].generatedAt).toBe('2026-04-26T12:00:00Z')
    expect(page1.nextCursor).toBeDefined()
    const page2 = listInsightSnapshots(db, { categoryId: c.id, limit: 2, cursor: page1.nextCursor })
    expect(page2.items).toHaveLength(1)
    expect(page2.nextCursor).toBeUndefined()
  })

  it('error 状态快照 — error_message 透传', () => {
    const c = createCategory(db, { name: 'C' })
    const id = insertInsightSnapshot(db, {
      categoryId: c.id, generatedAt: '2026-04-26T10:00:00Z',
      status: 'error', errorMessage: 'LLM 超时',
      sourceNoteIds: [], insights: [], model: 'm',
    })
    const got = getInsightSnapshot(db, id)!
    expect(got.status).toBe('error')
    expect(got.errorMessage).toBe('LLM 超时')
  })
})
```

- [ ] **Step 3: 跑测试确认 FAIL**

```
npx vitest run tests/db/insights.test.ts
```

期望: `Cannot find module '@/lib/db/insights'`。

- [ ] **Step 4: 实现 `lib/db/insights.ts`**

```ts
import type Database from 'better-sqlite3'
import type { InsightSnapshot, NoteSummary, TopicInsight } from '@/lib/types'

type NoteSummaryRow = {
  note_id: string
  summary: string
  keywords: string
  key_points: string
  highlights: string
  audience: string | null
  model: string
  created_at: string
}

type InsightRow = {
  id: number
  category_id: string
  generated_at: string
  status: string
  error_message: string | null
  source_note_ids: string
  insights: string
  model: string
}

function rowToSummary(r: NoteSummaryRow): NoteSummary {
  return {
    noteId: r.note_id,
    summary: r.summary,
    keywords: JSON.parse(r.keywords) as string[],
    keyPoints: JSON.parse(r.key_points) as string[],
    highlights: JSON.parse(r.highlights) as string[],
    audience: r.audience ?? undefined,
  }
}

function rowToSnapshot(r: InsightRow): InsightSnapshot {
  return {
    id: r.id,
    categoryId: r.category_id,
    generatedAt: r.generated_at,
    status: r.status as 'success' | 'error',
    errorMessage: r.error_message ?? undefined,
    sourceNoteIds: JSON.parse(r.source_note_ids) as string[],
    insights: JSON.parse(r.insights) as TopicInsight[],
    model: r.model,
  }
}

export function upsertNoteSummary(
  db: Database.Database,
  s: NoteSummary & { model: string }
): void {
  db.prepare(`
    INSERT OR IGNORE INTO note_summaries
      (note_id, summary, keywords, key_points, highlights, audience, model, created_at)
    VALUES (@noteId, @summary, @keywords, @keyPoints, @highlights, @audience, @model, @createdAt)
  `).run({
    noteId: s.noteId, summary: s.summary,
    keywords: JSON.stringify(s.keywords),
    keyPoints: JSON.stringify(s.keyPoints),
    highlights: JSON.stringify(s.highlights),
    audience: s.audience ?? null,
    model: s.model,
    createdAt: new Date().toISOString(),
  })
}

export function getNoteSummaries(
  db: Database.Database,
  noteIds: string[]
): Map<string, NoteSummary> {
  const out = new Map<string, NoteSummary>()
  if (noteIds.length === 0) return out
  const placeholders = noteIds.map(() => '?').join(',')
  const rows = db
    .prepare(`SELECT * FROM note_summaries WHERE note_id IN (${placeholders})`)
    .all(...noteIds) as NoteSummaryRow[]
  for (const r of rows) out.set(r.note_id, rowToSummary(r))
  return out
}

export function insertInsightSnapshot(
  db: Database.Database,
  input: {
    categoryId: string
    generatedAt: string
    status: 'success' | 'error'
    errorMessage?: string
    sourceNoteIds: string[]
    insights: TopicInsight[]
    model: string
  }
): number {
  const info = db.prepare(`
    INSERT INTO topic_insights
      (category_id, generated_at, status, error_message,
       source_note_ids, insights, model)
    VALUES (@categoryId, @generatedAt, @status, @errorMessage,
            @sourceNoteIds, @insights, @model)
  `).run({
    categoryId: input.categoryId,
    generatedAt: input.generatedAt,
    status: input.status,
    errorMessage: input.errorMessage ?? null,
    sourceNoteIds: JSON.stringify(input.sourceNoteIds),
    insights: JSON.stringify(input.insights),
    model: input.model,
  })
  return Number(info.lastInsertRowid)
}

export function getInsightSnapshot(
  db: Database.Database,
  id: number
): InsightSnapshot | undefined {
  const r = db.prepare(`SELECT * FROM topic_insights WHERE id = ?`).get(id) as InsightRow | undefined
  return r ? rowToSnapshot(r) : undefined
}

export function getLatestInsightSnapshot(
  db: Database.Database,
  categoryId: string
): InsightSnapshot | undefined {
  const r = db.prepare(`
    SELECT * FROM topic_insights
    WHERE category_id = ?
    ORDER BY generated_at DESC, id DESC
    LIMIT 1
  `).get(categoryId) as InsightRow | undefined
  return r ? rowToSnapshot(r) : undefined
}

function encodeCursor(generatedAt: string, id: number): string {
  return Buffer.from(`${generatedAt}|${id}`, 'utf8').toString('base64')
}
function decodeCursor(c: string): { generatedAt: string; id: number } | null {
  try {
    const decoded = Buffer.from(c, 'base64').toString('utf8')
    const idx = decoded.lastIndexOf('|')
    if (idx === -1) return null
    const generatedAt = decoded.slice(0, idx)
    const id = Number(decoded.slice(idx + 1))
    if (!generatedAt || !Number.isFinite(id)) return null
    return { generatedAt, id }
  } catch { return null }
}

export function listInsightSnapshots(
  db: Database.Database,
  params: { categoryId: string; limit?: number; cursor?: string }
): { items: InsightSnapshot[]; nextCursor?: string } {
  const limit = Math.min(params.limit ?? 20, 100)
  const where: string[] = ['category_id = @category_id']
  const bind: Record<string, unknown> = { category_id: params.categoryId, limit: limit + 1 }
  if (params.cursor) {
    const d = decodeCursor(params.cursor)
    if (d) {
      where.push('(generated_at, id) < (@cur_gen, @cur_id)')
      bind.cur_gen = d.generatedAt
      bind.cur_id = d.id
    }
  }
  const rows = db.prepare(`
    SELECT * FROM topic_insights
    WHERE ${where.join(' AND ')}
    ORDER BY generated_at DESC, id DESC
    LIMIT @limit
  `).all(bind) as InsightRow[]
  const items = rows.slice(0, limit).map(rowToSnapshot)
  const hasMore = rows.length > limit
  const nextCursor = hasMore
    ? encodeCursor(items[items.length - 1].generatedAt, items[items.length - 1].id)
    : undefined
  return { items, nextCursor }
}
```

- [ ] **Step 5: 跑测试确认 PASS**

```
npx vitest run tests/db/insights.test.ts
```

期望: 5/5 通过。

- [ ] **Step 6: 提交**

```bash
git add lib/types.ts lib/db/insights.ts tests/db/insights.test.ts
git commit -m "feat(db): note_summaries + topic_insights helpers"
```

---

## Task 3: LLM 客户端抽象

**Files:**
- Create: `lib/llm/client.ts`
- Create: `lib/llm/openai.ts`
- Create: `lib/llm/anthropic.ts`
- Test: `tests/llm/openai.test.ts`, `tests/llm/anthropic.test.ts`

- [ ] **Step 1: 写 `lib/llm/client.ts` 接口 + factory**

```ts
import { createOpenAIClient } from './openai'
import { createAnthropicClient } from './anthropic'

export interface LLMClient {
  generateStructured<T>(opts: {
    system: string
    user: string
    schema: Record<string, unknown>
    schemaName: string
    maxTokens?: number
  }): Promise<T>
  readonly modelId: string
}

export function getLLMClient(): LLMClient | null {
  const provider = process.env.LLM_PROVIDER
  const baseUrl = process.env.LLM_BASE_URL
  const apiKey = process.env.LLM_API_KEY
  const model = process.env.LLM_MODEL
  if (!provider || !baseUrl || !apiKey || !model) return null
  if (provider === 'openai') return createOpenAIClient({ baseUrl, apiKey, model })
  if (provider === 'anthropic') return createAnthropicClient({ baseUrl, apiKey, model })
  return null
}
```

- [ ] **Step 2: 写 `tests/llm/openai.test.ts` (失败)**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createOpenAIClient } from '@/lib/llm/openai'

const fetchMock = vi.fn()
beforeEach(() => { vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset() })
afterEach(() => { vi.unstubAllGlobals() })

describe('OpenAI-compatible LLM client', () => {
  it('POST /v1/chat/completions with response_format json_schema', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ ok: true, n: 5 }) } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }))

    const client = createOpenAIClient({
      baseUrl: 'https://api.example.com',
      apiKey: 'sk-x',
      model: 'gpt-test',
    })
    const result = await client.generateStructured<{ ok: boolean; n: number }>({
      system: 'sys', user: 'usr',
      schema: { type: 'object', properties: { ok: { type: 'boolean' }, n: { type: 'number' } }, required: ['ok','n'] },
      schemaName: 'demo',
    })
    expect(result).toEqual({ ok: true, n: 5 })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.example.com/v1/chat/completions')
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer sk-x',
      'Content-Type': 'application/json',
    })
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.model).toBe('gpt-test')
    expect(body.messages).toEqual([
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'usr' },
    ])
    expect(body.response_format.type).toBe('json_schema')
    expect(body.response_format.json_schema.name).toBe('demo')
    expect(body.response_format.json_schema.strict).toBe(true)
  })

  it('throws on non-2xx', async () => {
    fetchMock.mockResolvedValueOnce(new Response('boom', { status: 500 }))
    const client = createOpenAIClient({ baseUrl: 'https://x', apiKey: 'k', model: 'm' })
    await expect(client.generateStructured({
      system: 's', user: 'u', schema: {}, schemaName: 'n',
    })).rejects.toThrow(/500/)
  })

  it('throws on invalid JSON content', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      choices: [{ message: { content: 'not json' } }],
    }), { status: 200 }))
    const client = createOpenAIClient({ baseUrl: 'https://x', apiKey: 'k', model: 'm' })
    await expect(client.generateStructured({
      system: 's', user: 'u', schema: {}, schemaName: 'n',
    })).rejects.toThrow()
  })
})
```

- [ ] **Step 3: 跑测试确认 FAIL**

```
npx vitest run tests/llm/openai.test.ts
```

- [ ] **Step 4: 实现 `lib/llm/openai.ts`**

```ts
import type { LLMClient } from './client'

export function createOpenAIClient(opts: {
  baseUrl: string; apiKey: string; model: string
}): LLMClient {
  return {
    modelId: opts.model,
    async generateStructured<T>(args: {
      system: string; user: string
      schema: Record<string, unknown>; schemaName: string
      maxTokens?: number
    }): Promise<T> {
      const url = `${opts.baseUrl.replace(/\/$/, '')}/v1/chat/completions`
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${opts.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: opts.model,
          messages: [
            { role: 'system', content: args.system },
            { role: 'user', content: args.user },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: { name: args.schemaName, schema: args.schema, strict: true },
          },
          max_tokens: args.maxTokens ?? 4096,
        }),
      })
      if (!res.ok) {
        const detail = await res.text().catch(() => '')
        throw new Error(`OpenAI HTTP ${res.status}: ${detail.slice(0, 200)}`)
      }
      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>
      }
      const content = json.choices?.[0]?.message?.content
      if (!content) throw new Error('OpenAI: empty content')
      return JSON.parse(content) as T
    },
  }
}
```

- [ ] **Step 5: 跑测试确认 PASS**

```
npx vitest run tests/llm/openai.test.ts
```

- [ ] **Step 6: 写 `tests/llm/anthropic.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createAnthropicClient } from '@/lib/llm/anthropic'

const fetchMock = vi.fn()
beforeEach(() => { vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset() })
afterEach(() => { vi.unstubAllGlobals() })

describe('Anthropic LLM client', () => {
  it('POST /v1/messages with tool_use forced', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      content: [{ type: 'tool_use', name: 'demo', input: { ok: true, n: 5 } }],
    }), { status: 200 }))

    const client = createAnthropicClient({
      baseUrl: 'https://api.anthropic.com',
      apiKey: 'sk-ant-x',
      model: 'claude-x',
    })
    const out = await client.generateStructured<{ ok: boolean; n: number }>({
      system: 'sys', user: 'usr',
      schema: { type: 'object', properties: { ok: { type: 'boolean' }, n: { type: 'number' } }, required: ['ok','n'] },
      schemaName: 'demo',
    })
    expect(out).toEqual({ ok: true, n: 5 })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    expect((init as RequestInit).headers).toMatchObject({
      'x-api-key': 'sk-ant-x',
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    })
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.model).toBe('claude-x')
    expect(body.system).toBe('sys')
    expect(body.messages).toEqual([{ role: 'user', content: 'usr' }])
    expect(body.tools).toHaveLength(1)
    expect(body.tools[0].name).toBe('demo')
    expect(body.tools[0].input_schema).toBeDefined()
    expect(body.tool_choice).toEqual({ type: 'tool', name: 'demo' })
  })

  it('throws when content lacks tool_use block', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      content: [{ type: 'text', text: 'oops' }],
    }), { status: 200 }))
    const client = createAnthropicClient({ baseUrl: 'https://x', apiKey: 'k', model: 'm' })
    await expect(client.generateStructured({
      system: 's', user: 'u', schema: {}, schemaName: 'n',
    })).rejects.toThrow(/tool_use/)
  })

  it('throws on non-2xx', async () => {
    fetchMock.mockResolvedValueOnce(new Response('rate limited', { status: 429 }))
    const client = createAnthropicClient({ baseUrl: 'https://x', apiKey: 'k', model: 'm' })
    await expect(client.generateStructured({
      system: 's', user: 'u', schema: {}, schemaName: 'n',
    })).rejects.toThrow(/429/)
  })
})
```

- [ ] **Step 7: 跑确认 FAIL,然后实现 `lib/llm/anthropic.ts`**

```ts
import type { LLMClient } from './client'

export function createAnthropicClient(opts: {
  baseUrl: string; apiKey: string; model: string
}): LLMClient {
  return {
    modelId: opts.model,
    async generateStructured<T>(args: {
      system: string; user: string
      schema: Record<string, unknown>; schemaName: string
      maxTokens?: number
    }): Promise<T> {
      const url = `${opts.baseUrl.replace(/\/$/, '')}/v1/messages`
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'x-api-key': opts.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: opts.model,
          system: args.system,
          messages: [{ role: 'user', content: args.user }],
          tools: [{
            name: args.schemaName,
            description: 'Return structured data per schema.',
            input_schema: args.schema,
          }],
          tool_choice: { type: 'tool', name: args.schemaName },
          max_tokens: args.maxTokens ?? 4096,
        }),
      })
      if (!res.ok) {
        const detail = await res.text().catch(() => '')
        throw new Error(`Anthropic HTTP ${res.status}: ${detail.slice(0, 200)}`)
      }
      const json = (await res.json()) as {
        content?: Array<{ type: string; name?: string; input?: unknown }>
      }
      const tool = json.content?.find((b) => b.type === 'tool_use')
      if (!tool || !tool.input) throw new Error('Anthropic: missing tool_use block')
      return tool.input as T
    },
  }
}
```

- [ ] **Step 8: 跑两套测试,确认 PASS**

```
npx vitest run tests/llm/
```

- [ ] **Step 9: 提交**

```bash
git add lib/llm/ tests/llm/
git commit -m "feat(llm): provider-agnostic structured client (openai + anthropic)"
```

---

## Task 4: Prompts + JSON Schemas

**Files:**
- Create: `lib/llm/prompts.ts`
- Test: `tests/llm/prompts.test.ts`

- [ ] **Step 1: 写测试 (失败)**

```ts
import { describe, it, expect } from 'vitest'
import {
  NOTE_SUMMARY_SCHEMA, INSIGHTS_SCHEMA,
  buildNoteSummaryPrompt, buildInsightsPrompt,
} from '@/lib/llm/prompts'

describe('prompts', () => {
  it('NOTE_SUMMARY_SCHEMA: 必填字段齐全', () => {
    expect(NOTE_SUMMARY_SCHEMA.type).toBe('object')
    const required = (NOTE_SUMMARY_SCHEMA as { required: string[] }).required
    expect(required).toEqual(
      expect.arrayContaining(['summary', 'keywords', 'keyPoints', 'highlights'])
    )
  })

  it('INSIGHTS_SCHEMA: insights 数组,每项含 7 字段', () => {
    const props = (INSIGHTS_SCHEMA as { properties: Record<string, unknown> }).properties
    expect(props.insights).toBeDefined()
    const items = (props.insights as { items: { required: string[] } }).items
    expect(items.required).toEqual(
      expect.arrayContaining([
        'title', 'angle', 'evidenceNoteIds',
        'audience', 'contentFormat', 'differentiation', 'tags',
      ])
    )
  })

  it('buildNoteSummaryPrompt: 标题/作者/平台拼到 user', () => {
    const p = buildNoteSummaryPrompt({
      platform: 'xiaohongshu',
      title: 'AI 编程入门',
      author: '小明',
      summary: '简介',
      raw: 'long article body ...',
    })
    expect(p.system).toContain('内容分析助手')
    expect(p.user).toContain('AI 编程入门')
    expect(p.user).toContain('小明')
    expect(p.user).toContain('xiaohongshu')
  })

  it('buildNoteSummaryPrompt: raw 截断到 2000 字符', () => {
    const longRaw = 'x'.repeat(5000)
    const p = buildNoteSummaryPrompt({
      platform: 'wechat', title: 'T', author: 'A', summary: 'S', raw: longRaw,
    })
    expect(p.user.length).toBeLessThan(3000)
  })

  it('buildInsightsPrompt: 含分类名 + 笔记数量提示', () => {
    const p = buildInsightsPrompt({
      categoryName: 'Claude Code',
      summaries: [
        { noteId: 'n1', title: 'T1', hotScore: 80, platform: 'xiaohongshu',
          summary: 's1', keywords: ['k'], keyPoints: ['p'], highlights: ['h'] },
        { noteId: 'n2', title: 'T2', hotScore: 70, platform: 'wechat',
          summary: 's2', keywords: [], keyPoints: [], highlights: [] },
      ],
    })
    expect(p.system).toContain('选题策划')
    expect(p.system).toContain('至少 5 条')
    expect(p.user).toContain('Claude Code')
    expect(p.user).toContain('n1')
    expect(p.user).toContain('n2')
  })
})
```

- [ ] **Step 2: 跑确认 FAIL**

```
npx vitest run tests/llm/prompts.test.ts
```

- [ ] **Step 3: 实现 `lib/llm/prompts.ts`**

```ts
import type { Platform } from '@/lib/types'

export const NOTE_SUMMARY_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string', description: '一段 80-200 字的中文摘要' },
    keywords: {
      type: 'array', items: { type: 'string' },
      description: '3-8 个核心关键词',
    },
    keyPoints: {
      type: 'array', items: { type: 'string' },
      description: '3-6 条原文核心信息(陈述句)',
    },
    highlights: {
      type: 'array', items: { type: 'string' },
      description: '2-5 条值得注意的亮点(独特视角/反常识/数据)',
    },
    audience: { type: 'string', description: '目标受众 / 内容角度,可选' },
  },
  required: ['summary', 'keywords', 'keyPoints', 'highlights'],
}

export const INSIGHTS_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  properties: {
    insights: {
      type: 'array',
      minItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string', description: '选题标题(吸睛 + 信息密度)' },
          angle: { type: 'string', description: '切入点(为什么是这个角度)' },
          evidenceNoteIds: {
            type: 'array', items: { type: 'string' },
            description: '论据笔记 id(必须从输入摘要的 noteId 中选)',
          },
          audience: { type: 'string', description: '目标受众' },
          contentFormat: { type: 'string', description: '内容形式(短视频/长文/合集/...)' },
          differentiation: { type: 'string', description: '相对现有内容的差异化突破点' },
          tags: {
            type: 'array', items: { type: 'string' },
            description: '2-5 个分类标签',
          },
        },
        required: [
          'title', 'angle', 'evidenceNoteIds', 'audience',
          'contentFormat', 'differentiation', 'tags',
        ],
      },
    },
  },
  required: ['insights'],
}

const RAW_LIMIT = 2000

export function buildNoteSummaryPrompt(note: {
  platform: Platform | string
  title: string
  author: string
  summary: string
  raw: string
}): { system: string; user: string } {
  const trimmedRaw = note.raw.length > RAW_LIMIT
    ? note.raw.slice(0, RAW_LIMIT) + '...(截断)'
    : note.raw
  return {
    system:
      '你是内容分析助手。从输入的一篇笔记中抽取结构化信息，' +
      '用于后续选题洞察生成。严格按 JSON Schema 输出，不要解释，不要寒暄。',
    user: [
      `平台: ${note.platform}`,
      `标题: ${note.title}`,
      `作者: ${note.author}`,
      `摘要: ${note.summary}`,
      `原文: ${trimmedRaw}`,
    ].join('\n'),
  }
}

export function buildInsightsPrompt(args: {
  categoryName: string
  summaries: Array<{
    noteId: string
    title: string
    hotScore: number
    platform: Platform | string
    summary: string
    keywords: string[]
    keyPoints: string[]
    highlights: string[]
    audience?: string
  }>
}): { system: string; user: string } {
  return {
    system:
      '你是资深内容选题策划。基于输入的若干篇热门笔记的结构化摘要，' +
      '生成至少 5 条可执行的选题洞察。' +
      '每条要给出独特角度、目标受众、论据笔记(从输入 noteId 中选)、内容形式建议、差异化突破点。' +
      '严格按 JSON Schema 输出 { insights: TopicInsight[] }，不要解释，不要寒暄。',
    user: [
      `分类: ${args.categoryName}`,
      `共 ${args.summaries.length} 篇热门笔记摘要：`,
      JSON.stringify(args.summaries, null, 2),
    ].join('\n'),
  }
}
```

- [ ] **Step 4: 跑测试确认 PASS**

```
npx vitest run tests/llm/prompts.test.ts
```

- [ ] **Step 5: 提交**

```bash
git add lib/llm/prompts.ts tests/llm/prompts.test.ts
git commit -m "feat(llm): note-summary + insights prompts and JSON schemas"
```

---

## Task 5: 管线路由 `POST /api/insights/generate`

**Files:**
- Create: `app/api/insights/generate/route.ts`
- Test: `tests/api/insights-generate.test.ts`

- [ ] **Step 1: 写失败的集成测试**

```ts
// tests/api/insights-generate.test.ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { applyMigrations } from '@/lib/db/client'
import { createCategory } from '@/lib/db/categories'
import { runInsightsPipeline } from '@/app/api/insights/generate/route'
import {
  getLatestInsightSnapshot, getNoteSummaries,
} from '@/lib/db/insights'

let db: Database.Database
beforeEach(() => {
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  applyMigrations(db)
})
afterEach(() => { vi.restoreAllMocks() })

function seedNote(id: string, categoryId: string, hotScore: number) {
  db.prepare(`
    INSERT INTO collected_notes
      (id, category_id, platform, keyword, title, summary, author, url,
       published_at, collected_at, hot_score, raw)
    VALUES (?, ?, 'xiaohongshu', 'kw', 'T-'||?, 'S', 'A', 'http://x',
            '2026-04-26', '2026-04-26', ?, '{"orig":true}')
  `).run(id, categoryId, id, hotScore)
}

describe('runInsightsPipeline', () => {
  it('Stage 1 + Stage 2 串起来,写库,返回 snapshotId', async () => {
    const c = createCategory(db, { name: 'Cat1' })
    seedNote('n1', c.id, 90); seedNote('n2', c.id, 80)
    const llm = {
      modelId: 'mock-model',
      generateStructured: vi.fn()
        .mockResolvedValueOnce({
          summary: 's1', keywords: ['k1'], keyPoints: ['p1'], highlights: ['h1'],
        })
        .mockResolvedValueOnce({
          summary: 's2', keywords: ['k2'], keyPoints: ['p2'], highlights: ['h2'],
        })
        .mockResolvedValueOnce({
          insights: [
            { title: 'T1', angle: 'A1', evidenceNoteIds: ['n1'],
              audience: 'aud', contentFormat: 'fmt',
              differentiation: 'diff', tags: ['x'] },
            { title: 'T2', angle: 'A2', evidenceNoteIds: ['n2'],
              audience: 'aud', contentFormat: 'fmt',
              differentiation: 'diff', tags: ['x'] },
            { title: 'T3', angle: 'A3', evidenceNoteIds: [],
              audience: 'aud', contentFormat: 'fmt',
              differentiation: 'diff', tags: ['x'] },
            { title: 'T4', angle: 'A4', evidenceNoteIds: [],
              audience: 'aud', contentFormat: 'fmt',
              differentiation: 'diff', tags: ['x'] },
            { title: 'T5', angle: 'A5', evidenceNoteIds: [],
              audience: 'aud', contentFormat: 'fmt',
              differentiation: 'diff', tags: ['x'] },
          ],
        }),
    }
    const result = await runInsightsPipeline(db, llm, c.id)
    expect(result.snapshotId).toBeGreaterThan(0)
    expect(result.insightsCount).toBe(5)
    expect(result.sourceCount).toBe(2)
    expect(llm.generateStructured).toHaveBeenCalledTimes(3)

    const snap = getLatestInsightSnapshot(db, c.id)!
    expect(snap.status).toBe('success')
    expect(snap.insights).toHaveLength(5)
    expect(snap.sourceNoteIds).toEqual(expect.arrayContaining(['n1','n2']))
  })

  it('Stage 1 命中缓存时不再调用 LLM', async () => {
    const c = createCategory(db, { name: 'Cat1' })
    seedNote('n1', c.id, 90)
    db.prepare(`
      INSERT INTO note_summaries
        (note_id, summary, keywords, key_points, highlights, audience, model, created_at)
      VALUES ('n1', 'cached', '["c"]', '[]', '[]', NULL, 'old-model', '2026-04-26')
    `).run()
    const llm = {
      modelId: 'mock',
      generateStructured: vi.fn().mockResolvedValueOnce({
        insights: Array.from({ length: 5 }, (_, i) => ({
          title: `T${i}`, angle: 'a', evidenceNoteIds: [],
          audience: 'aud', contentFormat: 'fmt',
          differentiation: 'd', tags: [],
        })),
      }),
    }
    await runInsightsPipeline(db, llm, c.id)
    expect(llm.generateStructured).toHaveBeenCalledTimes(1)
    const map = getNoteSummaries(db, ['n1'])
    expect(map.get('n1')?.summary).toBe('cached')
  })

  it('Top 笔记为 0 时,跳过 Stage 1,Stage 2 仍跑(基于空摘要)', async () => {
    const c = createCategory(db, { name: 'Cat1' })
    const llm = {
      modelId: 'mock',
      generateStructured: vi.fn().mockResolvedValueOnce({
        insights: Array.from({ length: 5 }, (_, i) => ({
          title: `T${i}`, angle: 'a', evidenceNoteIds: [],
          audience: 'aud', contentFormat: 'fmt',
          differentiation: 'd', tags: [],
        })),
      }),
    }
    const r = await runInsightsPipeline(db, llm, c.id)
    expect(r.sourceCount).toBe(0)
    expect(llm.generateStructured).toHaveBeenCalledTimes(1)
  })

  it('Stage 2 失败 → 写入 error 行,抛错', async () => {
    const c = createCategory(db, { name: 'Cat1' })
    seedNote('n1', c.id, 90)
    const llm = {
      modelId: 'mock',
      generateStructured: vi.fn()
        .mockResolvedValueOnce({
          summary: 's', keywords: [], keyPoints: [], highlights: [],
        })
        .mockRejectedValueOnce(new Error('LLM 502')),
    }
    await expect(runInsightsPipeline(db, llm, c.id)).rejects.toThrow(/LLM 502/)
    const snap = getLatestInsightSnapshot(db, c.id)!
    expect(snap.status).toBe('error')
    expect(snap.errorMessage).toContain('LLM 502')
  })

  it('Stage 1 单篇失败被吞,不阻塞整体', async () => {
    const c = createCategory(db, { name: 'Cat1' })
    seedNote('n1', c.id, 90); seedNote('n2', c.id, 80)
    const llm = {
      modelId: 'mock',
      generateStructured: vi.fn()
        .mockRejectedValueOnce(new Error('one bad'))
        .mockResolvedValueOnce({
          summary: 's2', keywords: [], keyPoints: [], highlights: [],
        })
        .mockResolvedValueOnce({
          insights: Array.from({ length: 5 }, () => ({
            title: 't', angle: 'a', evidenceNoteIds: [],
            audience: 'aud', contentFormat: 'fmt',
            differentiation: 'd', tags: [],
          })),
        }),
    }
    const r = await runInsightsPipeline(db, llm, c.id)
    expect(r.sourceCount).toBe(1)
    expect(r.snapshotId).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: 跑确认 FAIL**

```
npx vitest run tests/api/insights-generate.test.ts
```

- [ ] **Step 3: 实现 `app/api/insights/generate/route.ts`**

```ts
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
```

- [ ] **Step 4: 跑测试确认 PASS**

```
npx vitest run tests/api/insights-generate.test.ts
```

期望: 5/5 通过。

- [ ] **Step 5: 提交**

```bash
git add app/api/insights/generate/route.ts tests/api/insights-generate.test.ts
git commit -m "feat(api): POST /api/insights/generate two-stage pipeline"
```

---

## Task 6: 读接口 `GET /api/insights/*`

**Files:**
- Create: `app/api/insights/latest/route.ts`
- Create: `app/api/insights/route.ts`
- Create: `app/api/insights/[id]/route.ts`

- [ ] **Step 1: 实现 `app/api/insights/latest/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db/client'
import { getLatestInsightSnapshot } from '@/lib/db/insights'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const categoryId = url.searchParams.get('categoryId')
  if (!categoryId) {
    return NextResponse.json({ error: 'Missing categoryId' }, { status: 400 })
  }
  const db = getDb()
  const snap = getLatestInsightSnapshot(db, categoryId)
  return NextResponse.json(snap ?? null)
}
```

- [ ] **Step 2: 实现 `app/api/insights/route.ts` (历史快照列表)**

```ts
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db/client'
import { listInsightSnapshots } from '@/lib/db/insights'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const categoryId = url.searchParams.get('categoryId')
  if (!categoryId) {
    return NextResponse.json({ error: 'Missing categoryId' }, { status: 400 })
  }
  const limit = Number(url.searchParams.get('limit') ?? 20)
  const cursor = url.searchParams.get('cursor') ?? undefined
  const db = getDb()
  const r = listInsightSnapshots(db, { categoryId, limit, cursor })
  return NextResponse.json({
    items: r.items.map((s) => ({
      id: s.id, generatedAt: s.generatedAt, status: s.status,
      errorMessage: s.errorMessage, model: s.model,
      insightsCount: s.insights.length,
      sourceCount: s.sourceNoteIds.length,
    })),
    nextCursor: r.nextCursor,
  })
}
```

- [ ] **Step 3: 实现 `app/api/insights/[id]/route.ts`**

```ts
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
```

- [ ] **Step 4: tsc + 全套测试**

```
npx tsc --noEmit && npx vitest run
```

- [ ] **Step 5: 提交**

```bash
git add app/api/insights/latest app/api/insights/route.ts 'app/api/insights/[id]'
git commit -m "feat(api): GET /api/insights latest+list+detail"
```

---

## Task 7: 数据层 (`lib/data/reports.ts` 新增)

**Files:**
- Modify: `lib/data/reports.ts`

- [ ] **Step 1: 在 `lib/data/reports.ts` 末尾追加新函数**

```ts
import type { InsightSnapshot } from '@/lib/types'

export type SnapshotListItem = {
  id: number
  generatedAt: string
  status: 'success' | 'error'
  errorMessage?: string
  model: string
  insightsCount: number
  sourceCount: number
}

export async function getLatestInsight(
  categoryId: string
): Promise<InsightSnapshot | null> {
  const res = await fetch(
    `/api/insights/latest?categoryId=${encodeURIComponent(categoryId)}`,
    { cache: 'no-store' }
  )
  if (!res.ok) return null
  return (await res.json()) as InsightSnapshot | null
}

export async function listInsightSnapshots(
  categoryId: string,
  opts?: { limit?: number; cursor?: string }
): Promise<{ items: SnapshotListItem[]; nextCursor?: string }> {
  const qs = new URLSearchParams({ categoryId })
  if (opts?.limit) qs.set('limit', String(opts.limit))
  if (opts?.cursor) qs.set('cursor', opts.cursor)
  const res = await fetch(`/api/insights?${qs}`, { cache: 'no-store' })
  if (!res.ok) return { items: [] }
  return (await res.json()) as { items: SnapshotListItem[]; nextCursor?: string }
}

export async function getInsightSnapshot(
  id: number
): Promise<InsightSnapshot | null> {
  const res = await fetch(`/api/insights/${id}`, { cache: 'no-store' })
  if (!res.ok) return null
  return (await res.json()) as InsightSnapshot
}

export async function regenerateInsight(
  categoryId: string
): Promise<{
  ok: boolean
  snapshotId?: number
  insightsCount?: number
  sourceCount?: number
  error?: string
}> {
  const res = await fetch('/api/insights/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ categoryId }),
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

- [ ] **Step 2: tsc**

```
npx tsc --noEmit
```

- [ ] **Step 3: 提交**

```bash
git add lib/data/reports.ts
git commit -m "feat(data): insights fetchers (latest/list/detail/regenerate)"
```

---

## Task 8: `InsightCard` UI 组件

**Files:**
- Create: `components/insight-card.tsx`

- [ ] **Step 1: 实现 `components/insight-card.tsx`**

```tsx
'use client'

import { Sparkles } from 'lucide-react'
import type { TopicInsight } from '@/lib/types'

export function InsightCard({
  insight,
  index,
}: {
  insight: TopicInsight
  index: number
}) {
  return (
    <div className="bg-white rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] p-5 flex flex-col gap-3">
      <div className="flex items-start gap-2">
        <span className="text-xs text-neutral-400 mt-1 tabular-nums w-6 shrink-0">
          {String(index + 1).padStart(2, '0')}
        </span>
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <h3 className="text-base font-medium text-neutral-900 leading-snug">
            {insight.title}
          </h3>
          <p className="text-sm text-neutral-600 leading-relaxed">
            <span className="text-neutral-400">切入点 · </span>
            {insight.angle}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pl-8 text-xs">
        <Field label="受众">{insight.audience}</Field>
        <Field label="形式建议">{insight.contentFormat}</Field>
        <Field label="差异化">{insight.differentiation}</Field>
      </div>

      {insight.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pl-8">
          {insight.tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center px-2 py-0.5 rounded-md bg-neutral-100 text-[11px] text-neutral-600"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      {insight.evidenceNoteIds.length > 0 && (
        <div className="pl-8 text-[11px] text-neutral-400 flex items-center gap-1">
          <Sparkles size={11} />
          论据笔记: {insight.evidenceNoteIds.length} 篇 ·
          <span className="ml-1 truncate">{insight.evidenceNoteIds.join(', ')}</span>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-neutral-400">{label}</span>
      <span className="text-neutral-700 leading-relaxed">{children}</span>
    </div>
  )
}
```

- [ ] **Step 2: tsc**

```
npx tsc --noEmit
```

- [ ] **Step 3: 提交**

```bash
git add components/insight-card.tsx
git commit -m "feat(ui): InsightCard component"
```

---

## Task 9: 页面接线 — `reports/page.tsx` + `report-viewer.tsx` + `topics-aggregate-view.tsx`

**Files:**
- Modify: `app/c/[categoryId]/reports/page.tsx`(完全重写,改两个 tab 含义)
- Modify: `components/report-viewer.tsx`(改用 InsightCard,接 regenerate)
- Modify: `components/topics-aggregate-view.tsx`(改为列历史快照)

- [ ] **Step 1: 重写 `app/c/[categoryId]/reports/page.tsx`**

```tsx
'use client'

import { use, useEffect, useState } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { ReportViewer } from '@/components/report-viewer'
import { TopicsAggregateView } from '@/components/topics-aggregate-view'
import { getLatestInsight, getInsightSnapshot } from '@/lib/data/reports'
import type { InsightSnapshot } from '@/lib/types'
import { cn } from '@/lib/utils'

type View = 'latest' | 'history'

export default function ReportsPage({
  params,
}: {
  params: Promise<{ categoryId: string }>
}) {
  const { categoryId } = use(params)
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams()
  const view = (search.get('view') as View) ?? 'latest'
  const snapshotIdParam = search.get('snapshot')

  const [snapshot, setSnapshot] = useState<InsightSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let alive = true
    setLoading(true)
    const loader = snapshotIdParam
      ? getInsightSnapshot(Number(snapshotIdParam))
      : getLatestInsight(categoryId)
    loader.then((s) => { if (alive) { setSnapshot(s); setLoading(false) } })
    return () => { alive = false }
  }, [categoryId, snapshotIdParam, refreshKey])

  function setView(v: View) {
    const qs = new URLSearchParams(search.toString())
    qs.set('view', v)
    qs.delete('snapshot')
    router.replace(`${pathname}?${qs}`)
  }

  function jumpToSnapshot(id: number) {
    const qs = new URLSearchParams()
    qs.set('view', 'latest')
    qs.set('snapshot', String(id))
    router.replace(`${pathname}?${qs}`)
  }

  return (
    <div className="p-8 flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex gap-0.5 bg-neutral-200/50 p-0.5 rounded-lg">
          <ViewTab active={view === 'latest'} onClick={() => setView('latest')}>
            最新洞察
          </ViewTab>
          <ViewTab active={view === 'history'} onClick={() => setView('history')}>
            历史快照
          </ViewTab>
        </div>
      </div>

      {view === 'latest' ? (
        <ReportViewer
          categoryId={categoryId}
          snapshot={snapshot}
          loading={loading}
          onRegenerated={() => setRefreshKey((k) => k + 1)}
        />
      ) : (
        <TopicsAggregateView
          categoryId={categoryId}
          onPick={jumpToSnapshot}
        />
      )}
    </div>
  )
}

function ViewTab({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-4 py-1.5 text-sm rounded-md transition-colors',
        active
          ? 'bg-white text-neutral-900 shadow-sm font-medium'
          : 'text-neutral-500 hover:text-neutral-700'
      )}
    >
      {children}
    </button>
  )
}
```

- [ ] **Step 2: 重写 `components/report-viewer.tsx`**

```tsx
'use client'

import { useState } from 'react'
import dayjs from 'dayjs'
import { RefreshCw, Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import type { InsightSnapshot } from '@/lib/types'
import { regenerateInsight } from '@/lib/data/reports'
import { InsightCard } from '@/components/insight-card'
import { cn } from '@/lib/utils'

export function ReportViewer({
  categoryId,
  snapshot,
  loading,
  onRegenerated,
}: {
  categoryId: string
  snapshot: InsightSnapshot | null
  loading: boolean
  onRegenerated: () => void
}) {
  const [regenerating, setRegenerating] = useState(false)

  async function handleRegenerate() {
    setRegenerating(true)
    const r = await regenerateInsight(categoryId)
    setRegenerating(false)
    if (!r.ok) {
      toast.error(`生成失败：${r.error}`)
      return
    }
    toast.success(`已生成 ${r.insightsCount} 条洞察(基于 ${r.sourceCount} 篇笔记)`)
    onRegenerated()
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] p-12 text-center text-sm text-neutral-400">
        <Loader2 className="animate-spin inline mr-2" size={14} />加载中…
      </div>
    )
  }

  if (!snapshot) {
    return (
      <div className="bg-white rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] p-12 flex flex-col items-center gap-4">
        <Sparkles size={28} className="text-neutral-300" />
        <p className="text-sm text-neutral-500">该分类暂无 AI 洞察</p>
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
      </div>
    )
  }

  if (snapshot.status === 'error') {
    return (
      <div className="bg-white rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] p-8 flex flex-col gap-4">
        <p className="text-sm text-red-600">
          上次生成失败：{snapshot.errorMessage ?? '未知错误'}
        </p>
        <button
          onClick={handleRegenerate}
          disabled={regenerating}
          className={cn(
            'self-start inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-neutral-100 text-neutral-700 hover:bg-neutral-200/70 transition-colors',
            regenerating && 'cursor-wait opacity-60'
          )}
        >
          <RefreshCw size={13} className={regenerating ? 'animate-spin' : ''} />
          {regenerating ? '生成中…' : '重新生成'}
        </button>
      </div>
    )
  }

  return (
    <article className="space-y-6">
      <header className="bg-white rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] p-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-neutral-900 mb-1.5">
            选题洞察
          </h2>
          <p className="text-xs text-neutral-400">
            生成于 {dayjs(snapshot.generatedAt).format('YYYY-MM-DD HH:mm')} ·
            模型 {snapshot.model} ·
            基于 {snapshot.sourceNoteIds.length} 篇笔记 · {snapshot.insights.length} 条洞察
          </p>
        </div>
        <button
          onClick={handleRegenerate}
          disabled={regenerating}
          className={cn(
            'shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-neutral-100 text-neutral-700 hover:bg-neutral-200/70 transition-colors',
            regenerating && 'cursor-wait opacity-60'
          )}
        >
          <RefreshCw size={13} className={regenerating ? 'animate-spin' : ''} />
          {regenerating ? '分析中…' : '重新生成'}
        </button>
      </header>

      <div className="space-y-3">
        {snapshot.insights.map((it, i) => (
          <InsightCard key={`${snapshot.id}-${i}`} insight={it} index={i} />
        ))}
      </div>
    </article>
  )
}
```

- [ ] **Step 3: 重写 `components/topics-aggregate-view.tsx`(改为历史快照列表)**

```tsx
'use client'

import { useEffect, useState } from 'react'
import dayjs from 'dayjs'
import { ChevronRight, Loader2 } from 'lucide-react'
import { listInsightSnapshots, type SnapshotListItem } from '@/lib/data/reports'
import { cn } from '@/lib/utils'

export function TopicsAggregateView({
  categoryId,
  onPick,
}: {
  categoryId: string
  onPick: (id: number) => void
}) {
  const [items, setItems] = useState<SnapshotListItem[]>([])
  const [cursor, setCursor] = useState<string | undefined>()
  const [loading, setLoading] = useState(true)
  const [done, setDone] = useState(false)

  useEffect(() => {
    let alive = true
    setLoading(true); setDone(false); setCursor(undefined); setItems([])
    listInsightSnapshots(categoryId, { limit: 20 }).then((r) => {
      if (!alive) return
      setItems(r.items)
      setCursor(r.nextCursor)
      if (!r.nextCursor) setDone(true)
      setLoading(false)
    })
    return () => { alive = false }
  }, [categoryId])

  async function loadMore() {
    if (!cursor || loading) return
    setLoading(true)
    const r = await listInsightSnapshots(categoryId, { limit: 20, cursor })
    setItems((prev) => [...prev, ...r.items])
    setCursor(r.nextCursor)
    if (!r.nextCursor) setDone(true)
    setLoading(false)
  }

  if (loading && items.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] p-12 text-center text-sm text-neutral-400">
        <Loader2 className="animate-spin inline mr-2" size={14} />加载中…
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] p-12 text-center text-sm text-neutral-400">
        暂无历史快照,先点「最新洞察」→「重新生成」
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] divide-y divide-neutral-100">
      {items.map((it) => {
        const failed = it.status === 'error'
        return (
          <button
            key={it.id}
            onClick={() => !failed && onPick(it.id)}
            disabled={failed}
            className={cn(
              'w-full flex items-center gap-4 px-5 py-3.5 text-sm text-left',
              !failed && 'hover:bg-neutral-50 cursor-pointer',
              failed && 'cursor-default'
            )}
          >
            <span className="text-neutral-400 tabular-nums w-36">
              {dayjs(it.generatedAt).format('YYYY-MM-DD HH:mm')}
            </span>
            <span className="text-[11px] text-neutral-400 w-32 truncate">{it.model}</span>
            <span className="flex-1" />
            {failed ? (
              <span className="text-red-600 text-xs truncate max-w-[300px]">
                ✗ {it.errorMessage ?? '失败'}
              </span>
            ) : (
              <span className="text-neutral-700">
                {it.insightsCount} 条 · 基于 {it.sourceCount} 篇
              </span>
            )}
            {!failed && <ChevronRight size={14} className="text-neutral-400" />}
          </button>
        )
      })}
      {!done && (
        <button
          onClick={loadMore}
          disabled={loading}
          className="w-full py-3 text-sm text-neutral-500 hover:text-neutral-900 disabled:opacity-50"
        >
          {loading ? <Loader2 size={14} className="animate-spin inline" /> : '加载更多'}
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: tsc + 全套测试**

```
npx tsc --noEmit && npx vitest run
```

期望: 全绿(包括之前所有 7 个测试文件 + 本期 5 个新增)。

- [ ] **Step 5: 浏览器手测**

```
1. 配 .env.local: LLM_PROVIDER=openai, LLM_BASE_URL=<你的兼容端点>,
   LLM_API_KEY=<key>, LLM_MODEL=<model>
2. npm run dev,打开 /c/{某分类}/reports
3. 「最新洞察」tab 显示空态,点「生成洞察」
4. 等待 30-60s,看到 ≥5 条洞察卡片
5. 点「重新生成」,日志只调 Stage 2 一次(Stage 1 全命中缓存)
6. 切换 LLM_PROVIDER=anthropic,重启 dev,再点「重新生成」,正常输出
7. 切「历史快照」tab,看到所有快照,点其一回到最新洞察 tab 渲染该快照
8. 删除 .env.local 的 LLM_API_KEY,重启 dev,点「生成洞察」,toast 出 503 提示
```

- [ ] **Step 6: 提交**

```bash
git add 'app/c/[categoryId]/reports/page.tsx' \
        components/report-viewer.tsx \
        components/topics-aggregate-view.tsx
git commit -m "feat(ui): wire reports page to LLM insights pipeline"
```

---

## Self-Review

**Spec coverage:**
- 章节 §3 触发流程 → Task 5 (POST), Task 9 (按钮接线) ✓
- 章节 §3 视图(最新/历史) → Task 9 ✓
- 章节 §4.1 SQL → Task 1 ✓
- 章节 §4.2 TS 类型 → Task 2 (types), Task 4 (schemas 一致) ✓
- 章节 §5 LLM 抽象(双 provider) → Task 3 ✓
- 章节 §6 管线流程(Top 10 / 7d / 缓存 / 并发 / 错误降级) → Task 5 ✓
- 章节 §6.2 Prompts → Task 4 ✓
- 章节 §7 接口 → Task 5 + Task 6 ✓
- 章节 §9 错误处理(503/502/单篇失败/级联删除) → Task 1+2+5 测试覆盖 ✓
- 章节 §10 验收清单 → Task 9 浏览器手测覆盖 ✓

**Placeholder scan:** 无 TBD/TODO/「以此类推」, 每段代码完整可粘贴。

**Type consistency:**
- `NoteSummary` / `TopicInsight` / `InsightSnapshot`: Task 2 定义 → Task 5 (insertInsightSnapshot 输入) → Task 7 (data 层) → Task 9 (UI) 一致 ✓
- `LLMClient` 接口: Task 3 定义 → Task 5 (`generateStructured` 调用) 一致 ✓
- `runInsightsPipeline` 返回 `{ snapshotId, insightsCount, sourceCount, generatedAt }`: Task 5 定义 → Task 7 (regenerateInsight 解构) → Task 9 (toast 用 insightsCount/sourceCount) 一致 ✓
- DB 列名 (`note_summaries.note_id` / `topic_insights.generated_at`): Task 1 schema → Task 2 row mapper → Task 5 SQL 一致 ✓
