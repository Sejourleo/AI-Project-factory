# LLM 选题洞察 设计规范

**日期：** 2026-04-25
**状态：** Draft（待用户审核）
**关联：** 替换当前选题分析页(`app/c/[categoryId]/reports`)的 fixture-only 数值逻辑

---

## 1. 目标

把现在「选题分析报告」的硬编码 fixture 数据替换为**两阶段 LLM 管线**：

1. **Stage 1 (map)** — 对该分类下 Top 10 热门笔记逐篇抽取摘要 + 关键词 + 核心信息 + 亮点，结构化缓存。
2. **Stage 2 (reduce)** — 把 Stage 1 的全部摘要喂给 LLM，产出 ≥5 条结构化选题洞察。

输出结果用于支撑用户对该分类话题的深度分析。

## 2. 范围

**包含：**
- 新增 `note_summaries` / `topic_insights` 两张表
- 新增 LLM 客户端抽象（OpenAI-compatible + Anthropic 双路径）
- 新增 `POST /api/insights/generate` / `GET /api/insights` 接口
- 改写 `app/c/[categoryId]/reports` 页面，替换 fixture 渲染
- 保留 `TopicSuggestion` 类型不删除（向后兼容）

**不包含：**
- 不做定时自动触发（保留手动「重新生成」按钮）
- 不引入流式响应（一次返回结构化 JSON）
- 不做多轮对话或 follow-up 问答
- `lib/fixtures/reports.ts` 不删除，仅停止被 UI 调用

## 3. 用户交互

### 3.1 触发流程

1. 用户进入 `/c/{id}/reports`
2. 默认展示该分类**最新**的 `topic_insights` 快照（如无则提示"先点击重新生成"）
3. 点击右上角「重新生成」按钮 → `POST /api/insights/generate { categoryId }`
4. 按钮变 loading（实际可能 30-60s），完成后刷新展示新快照

### 3.2 视图

`reports/page.tsx` 现有两个 tab 改为：

- **最新洞察**：渲染 `getLatestInsight(categoryId)` 返回的 `TopicInsight[]`，每条卡片字段见 §4.2
- **历史快照**：列出 `listInsightSnapshots(categoryId)`，每行 `{generated_at, count, model}`，点击展开查看那次的 insights

「按日期」与「按选题」语义不再适用 → 改名为「最新洞察」「历史快照」。

### 3.3 卡片渲染

新增 `components/insight-card.tsx`，渲染 `TopicInsight`（§4.2）字段。
旧 `components/topic-card.tsx` 保留不动，但本期不再被引用。

## 4. 数据模型

### 4.1 SQL 表（新增到 `lib/db/client.ts` 的 schema）

```sql
CREATE TABLE IF NOT EXISTS note_summaries (
  note_id TEXT PRIMARY KEY,
  summary TEXT NOT NULL,                -- 摘要(≤200 字)
  keywords TEXT NOT NULL,               -- JSON: string[]
  key_points TEXT NOT NULL,             -- JSON: string[] (核心信息)
  highlights TEXT NOT NULL,             -- JSON: string[] (亮点)
  audience TEXT,                        -- 受众/角度,可空
  model TEXT NOT NULL,                  -- 生成模型(用于排查)
  created_at TEXT NOT NULL,
  FOREIGN KEY (note_id) REFERENCES collected_notes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS topic_insights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success','error')),
  error_message TEXT,
  source_note_ids TEXT NOT NULL,        -- JSON: string[]
  insights TEXT NOT NULL,               -- JSON: TopicInsight[]
  model TEXT NOT NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_topic_insights_cat_time
  ON topic_insights(category_id, generated_at DESC);
```

**永久缓存策略：** Stage 1 用 `INSERT OR IGNORE`，同一 `note_id` 只调用 LLM 一次。Stage 2 每次手动触发都新插一行，保留全部历史。

### 4.2 TS 类型（添加到 `lib/types.ts`）

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
  title: string              // 选题标题
  angle: string              // 切入点
  evidenceNoteIds: string[]  // 论据(笔记 id,UI 可链回)
  audience: string           // 受众
  contentFormat: string      // 内容形式建议(短视频/长文/合集...)
  differentiation: string    // 差异化角度
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

`TopicSuggestion` 保留不删,旧 fixture 类型不动。

## 5. LLM 抽象

### 5.1 接口

```ts
// lib/llm/client.ts
export interface LLMClient {
  generateStructured<T>(opts: {
    system: string
    user: string
    schema: Record<string, unknown>  // JSON Schema
    schemaName: string
    maxTokens?: number
  }): Promise<T>
  readonly modelId: string
}

export function getLLMClient(): LLMClient  // 读 env 决定 provider
```

### 5.2 Provider 实现

**OpenAI-compatible** (`/v1/chat/completions`)：
```ts
{
  model,
  messages: [{role:'system',content}, {role:'user',content}],
  response_format: {
    type: 'json_schema',
    json_schema: { name: schemaName, schema, strict: true }
  }
}
```

**Anthropic** (`/v1/messages`,用 tool use 强制结构化)：
```ts
{
  model,
  system,
  messages: [{role:'user',content}],
  tools: [{ name: schemaName, input_schema: schema }],
  tool_choice: { type: 'tool', name: schemaName },
  max_tokens: 4096
}
// 从 response.content[0].input 取结构化结果
```

### 5.3 配置（`.env.local`）

```bash
LLM_PROVIDER=openai          # 或 anthropic
LLM_BASE_URL=https://api.deepseek.com   # OpenAI-compatible 时是兼容端点
LLM_API_KEY=sk-...
LLM_MODEL=deepseek-chat      # 或 claude-sonnet-4-6
```

Provider 不配置时 → 路由返回 `503 LLM not configured`，UI 显示提示而非崩溃。

## 6. 管线流程

### 6.1 `POST /api/insights/generate`

```
1. 读 categoryId,校验存在
2. SELECT id, title, summary, author, url, hot_score, raw
   FROM collected_notes
   WHERE category_id=? AND collected_at > now()-7d
   ORDER BY hot_score DESC LIMIT 10
3. 对每篇笔记:
   a. 查 note_summaries(note_id) → 命中则跳过
   b. 否则调 Stage 1 prompt → 写入 note_summaries (INSERT OR IGNORE)
   并发 5 路,失败的篇目跳过(记 console.warn,不阻塞整体)
4. 收集所有可用 NoteSummary (含命中缓存的 + 本次新生成的)
5. 调 Stage 2 prompt(输入: 摘要列表 + 笔记元数据)
   → 解析出 TopicInsight[](LLM 返回 ≥5 条)
6. INSERT INTO topic_insights (category_id, generated_at, status='success',
                                source_note_ids, insights, model)
7. 返回 { snapshotId, generatedAt, count, sourceCount }
```

错误路径：Stage 2 失败 → 写一行 `status='error', error_message=...`，前端展示失败提示。

### 6.2 Prompts

**Stage 1 system：**
> 你是内容分析助手。从输入的一篇笔记中抽取结构化信息，用于后续选题洞察。
> 严格按 JSON Schema 输出。

**Stage 1 user：**
> 平台: {platform}
> 标题: {title}
> 作者: {author}
> 摘要: {summary}
> 原文片段: {raw 截断到 2000 字符}

**Stage 2 system：**
> 你是资深内容选题策划。基于以下 N 篇热门笔记的结构化摘要，生成至少 5 条**可执行**的选题洞察。
> 每条要给出独特角度、目标受众、论据笔记、内容形式建议、差异化突破点。
> 严格按 JSON Schema 输出 `{ insights: TopicInsight[] }`。

**Stage 2 user：**
> 分类: {categoryName}
> 笔记摘要列表（JSON）：
> [{ noteId, title, summary, keywords, keyPoints, highlights, hotScore, platform }, ...]

JSON Schema 与 §4.2 TS 类型严格对应，`evidenceNoteIds` 必须从输入笔记 id 中选取。

## 7. 接口

### 7.1 `POST /api/insights/generate`
- body: `{ categoryId: string }`
- 200: `{ snapshotId, generatedAt, insightsCount, sourceCount }`
- 503: `{ error: 'LLM not configured' }`
- 502: `{ error: 'LLM call failed', detail }`(已写入 error 行)

### 7.2 `GET /api/insights/latest?categoryId=X`
- 200: `InsightSnapshot | null`

### 7.3 `GET /api/insights?categoryId=X&limit=20&cursor=...`
- 200: `{ items: Array<Pick<InsightSnapshot,'id'|'generatedAt'|'status'|'model'>> & { insightsCount: number }, nextCursor?: string }`

### 7.4 `GET /api/insights/:id`
- 200: `InsightSnapshot`
- 404: `{ error: 'Not found' }`

## 8. 文件变更清单

**新建（10）：**
- `lib/llm/client.ts`
- `lib/llm/openai.ts`
- `lib/llm/anthropic.ts`
- `lib/llm/prompts.ts`
- `lib/db/insights.ts`
- `app/api/insights/generate/route.ts`
- `app/api/insights/route.ts`
- `app/api/insights/latest/route.ts`
- `app/api/insights/[id]/route.ts`
- `components/insight-card.tsx`

**修改（7）：**
- `lib/db/client.ts`(加两张表的 schema)
- `lib/types.ts`(加 `NoteSummary` / `TopicInsight` / `InsightSnapshot`)
- `lib/data/reports.ts`(新增 `getLatestInsight` / `listInsightSnapshots` / `regenerateInsight`)
- `app/c/[categoryId]/reports/page.tsx`(改 tab 名 + 切换数据源)
- `components/report-viewer.tsx`(改用 InsightCard,接 LLM 触发)
- `components/topics-aggregate-view.tsx`(改为列历史快照)
- `.env.local.example` + `README.md`(LLM 环境变量说明)

**测试（4）：**
- `tests/llm/openai.test.ts`(mock fetch 验证 body schema)
- `tests/llm/anthropic.test.ts`
- `tests/db/insights.test.ts`(CRUD + cascade)
- `tests/api/insights-generate.test.ts`(mock LLMClient,验证管线)

## 9. 错误处理

| 场景 | 行为 |
|---|---|
| LLM env 未配置 | API 返回 503,UI 提示去 `.env.local` 配置 |
| Top 10 笔记不足 10 篇 | 用实际数量，不强制凑够 |
| Stage 1 单篇失败 | 跳过,继续。最终 sourceCount<10 但仍可生成 |
| 全部 Stage 1 失败 | Stage 2 不调用,写 error 行 |
| Stage 2 LLM 返回非法 JSON | 经 strict json_schema 不应发生；若发生记 error 行 |
| Stage 2 返回 insights<5 | 接受不重试(prompt 已要求 ≥5,LLM 决定) |
| 笔记被删除 | `ON DELETE CASCADE` 自动清理 note_summaries；topic_insights 中的 evidenceNoteIds 可能成为孤指针，UI 链接渲染时 graceful fallback |

## 10. 验收清单

- [ ] 在配置好 OpenAI 兼容 key 的环境下点「重新生成」，30-60s 后看到 ≥5 条洞察
- [ ] 切换 `LLM_PROVIDER=anthropic` 重新生成，输出结构等价
- [ ] 二次点击「重新生成」，Stage 1 全部命中缓存（看后端日志只调 Stage 2 一次）
- [ ] 历史快照 tab 显示之前所有快照，点击可展开查看
- [ ] 删除一篇 `collected_notes` 行后，对应 `note_summaries` 自动消失
- [ ] LLM key 缺失时按钮点击得到友好 503 提示，UI 不崩
- [ ] `npx tsc --noEmit` 通过，`npx vitest run` 通过

---

## 自检（spec self-review）

**Placeholder scan:** 无 TBD/TODO，所有字段明确。
**Internal consistency:** TS 类型 §4.2 ↔ SQL §4.1 ↔ JSON Schema §6.2 一致。`evidenceNoteIds` 在三处都是 `string[]`。
**Scope check:** 单一目标(LLM 替换 fixture)，10 个新文件聚焦于一个特性，适合单一 plan。
**Ambiguity check:** "≥5 条" 由 prompt 表达，不强制返回时重试 — 已在 §9 显式标注接受。`raw` 截断到 2000 字符 — 已在 §6.2 明确。
