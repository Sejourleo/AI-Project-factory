# Vercel 部署改造实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将「内容工厂」merged 项目部署到 Vercel：把采集 Agent 的 SQLite 持久化层换成 Vercel Postgres，同时保证本地用 Docker Postgres 完整可跑，最终把代码托管到 GitHub 并完成 Vercel 部署。

**Architecture:** `lib/db/*.ts` 全部重写为异步、参数化的 PG 查询，`@vercel/postgres` 自动消费 `POSTGRES_URL`；本地通过 Docker Compose 起 `postgres:16`；测试通过 vitest 单 fork 运行 + `TRUNCATE`-per-test 隔离；现有 13 个 API 路由 consumer 加 `await` 即可工作。

**Tech Stack:** Next.js 16 / React 19 / `@vercel/postgres` / `pg` / Vitest 4 / Docker Compose / Postgres 16

**Working directory（每个 task 都从这里出发）：** `/Users/yves/ai编程项目/内容工厂采集与分析`

---

## DB 层接口契约（全部 task 共用，提前对齐）

迁移后 `lib/db/*.ts` 的最终 API 形态：

```ts
// lib/db/client.ts
export { sql, db } from '@vercel/postgres'         // sql=template tag, db=Pool with .query()
export async function ensureMigrated(): Promise<void>   // 幂等，每个 lambda 实例只跑一次
export type NoteRow = { ... }                            // 保持，类型供 API 路由使用

// lib/db/categories.ts (全部函数变成 async，去掉首参 db)
export async function listCategories(): Promise<Category[]>
export async function getCategoryById(id: string): Promise<Category | undefined>
export async function createCategory(input: { name: string; color?: string }): Promise<Category>
export async function updateCategoryName(id: string, name: string): Promise<void>
export async function updateCategoryAccounts(id: string, accounts: MonitorSettings['accounts']): Promise<void>
export async function deleteCategory(id: string): Promise<void>
export async function replaceKeywords(categoryId: string, keywords: KeywordConfig[]): Promise<void>

// lib/db/queries.ts
export type QueryStatus = 'success' | 'error'
export type QuerySummary = { id: number; categoryId: string; ... }    // 不变
export type NoteSnapshot = { ... }                                     // 不变
export type QueryNote = ContentItem & { snapshot: NoteSnapshot }       // 不变
export type QueryDetail = { query: QuerySummary; notes: QueryNote[] }  // 不变
export type ListQueriesParams = { ... }                                // 不变
export type ListQueriesResult = { items: QuerySummary[]; nextCursor?: string }
export async function logQuerySuccess(input: ...): Promise<number>
export async function logQueryError(input: ...): Promise<number>
export async function listQueries(params: ListQueriesParams): Promise<ListQueriesResult>
export async function getQueryWithNotes(queryId: number): Promise<QueryDetail | undefined>

// lib/db/insights.ts
export async function upsertNoteSummary(s: NoteSummary & { model: string }): Promise<void>
export async function getNoteSummaries(noteIds: string[]): Promise<Map<string, NoteSummary>>
export async function insertInsightSnapshot(input: ...): Promise<number>
export async function getInsightSnapshot(id: number): Promise<InsightSnapshot | undefined>
export async function getLatestInsightSnapshot(categoryId: string): Promise<InsightSnapshot | undefined>
export async function listInsightSnapshots(params: { ... }): Promise<{ items: InsightSnapshot[]; nextCursor?: string }>

// lib/db/seed.ts
export async function seedIfEmpty(): Promise<void>
```

**与旧 API 的差异**：
- 全部函数变 `async`
- 全部函数去掉首参 `db: Database.Database`（caller 也别再 `getDb()`）
- JSONB 返回 JS object/array，不再需要 `JSON.parse`

caller 需要 sprinkle `await`，但不再 import `getDb`。

---

## Task 1：Bootstrap（依赖 + Docker + 环境）

**Files:**
- Modify: `package.json`
- Modify: `.env.local`（增加 POSTGRES_URL，本地）
- Modify: `.env.example`
- Modify: `.gitignore`
- Create: `docker-compose.yml`
- Delete: `data/` 目录
- Run: `npm install`，`docker compose up -d`

- [ ] **Step 1：编辑 `package.json`**

读 `package.json`，做这些改动：
- dependencies 中**删除** `"better-sqlite3": "^12.9.0"`
- devDependencies 中**删除** `"@types/better-sqlite3": "^7.6.13"`
- dependencies 中**新增** `"@vercel/postgres": "^0.10.0"`、`"pg": "^8.13.1"`
- devDependencies 中**新增** `"@types/pg": "^8.11.10"`

修改完 dependencies 块应该长这样（按字母排序保持原风格）：

```json
"dependencies": {
  "@base-ui/react": "^1.4.0",
  "@tiptap/extension-image": "^3.22.5",
  "@tiptap/extension-placeholder": "^3.22.5",
  "@tiptap/pm": "^3.22.5",
  "@tiptap/react": "^3.22.5",
  "@tiptap/starter-kit": "^3.22.5",
  "@vercel/postgres": "^0.10.0",
  "class-variance-authority": "^0.7.1",
  "clsx": "^2.1.1",
  "dayjs": "^1.11.20",
  "lucide-react": "^1.8.0",
  "nanoid": "^5.1.9",
  "next": "^16.2.4",
  "next-themes": "^0.4.6",
  "pg": "^8.13.1",
  "react": "^19.2.5",
  "react-dom": "^19.2.5",
  "shadcn": "^4.3.0",
  "sonner": "^2.0.7",
  "tailwind-merge": "^3.5.0",
  "tw-animate-css": "^1.4.0",
  "zustand": "^5.0.12"
},
"devDependencies": {
  "@tailwindcss/postcss": "^4.2.2",
  "@testing-library/jest-dom": "^6.9.1",
  "@testing-library/react": "^16.3.2",
  "@types/node": "^22",
  "@types/pg": "^8.11.10",
  "@types/react": "^19",
  "@types/react-dom": "^19",
  "@vitejs/plugin-react": "^6.0.1",
  "@vitest/ui": "^4.1.4",
  "eslint": "^9",
  "eslint-config-next": "16.2.4",
  "jsdom": "^29.1.0",
  "tailwindcss": "^4.2.2",
  "typescript": "^5",
  "vitest": "^4.1.4"
}
```

- [ ] **Step 2：创建 `docker-compose.yml`**

在项目根创建 `docker-compose.yml`，内容：

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: content-factory-pg
    environment:
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev
      POSTGRES_DB: content_factory
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dev -d content_factory"]
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  postgres-data:
```

- [ ] **Step 3：更新 `.env.local`（本地，不入 git）**

读 `.env.local`，在文件末尾追加（保留所有现有 keys）：

```
POSTGRES_URL=postgres://dev:dev@localhost:5432/content_factory
CRON_SECRET=local-dev-cron-secret
```

如果 `CRON_SECRET` 已存在则不重复添加。

- [ ] **Step 4：更新 `.env.example`**

读 `.env.example`，在文件末尾追加：

```
# Postgres database (本地 docker compose 默认)
# 部署时由 Vercel Postgres 自动注入，不需要在面板填
POSTGRES_URL=postgres://dev:dev@localhost:5432/content_factory

# Cron 端点保护密钥（手动 curl 触发 /api/cron/daily-insights 时用）
CRON_SECRET=replace-with-random-string
```

- [ ] **Step 5：更新 `.gitignore`**

读 `.gitignore`。如果存在 `data/` 或 `data/*.db*` 这类条目，**删掉它们**（不再用本地 SQLite 文件）。同时**新增**：

```

# Local Postgres data volume (managed by docker compose)
postgres-data/
```

- [ ] **Step 6：删除 `data/` 目录**

```bash
rm -rf data/
```

- [ ] **Step 7：安装新依赖**

```bash
npm install
```

预期：`@vercel/postgres`、`pg`、`@types/pg` 安装成功；`better-sqlite3`、`@types/better-sqlite3` 被移除；package-lock.json 更新。

可能 warning：peer deps 不一致（如有），可忽略。

- [ ] **Step 8：启动 Docker Postgres**

```bash
docker compose up -d
```

预期：拉镜像（首次）、启动 container `content-factory-pg`。等约 10 秒让 healthcheck 通过。验证：

```bash
docker compose ps
```

应看到 `postgres` 服务 `healthy`。

如果端口 5432 已被本机其它服务占用：先 `lsof -i :5432` 找到进程，要么停掉它，要么改 `docker-compose.yml` 的 `ports` 为 `"5433:5432"` 并相应改 `.env.local` 的 `POSTGRES_URL` 为 `postgres://dev:dev@localhost:5433/content_factory`。

- [ ] **Step 9：连通性测试**

```bash
docker exec -it content-factory-pg psql -U dev -d content_factory -c "SELECT version();"
```

预期：打印 PostgreSQL 16.x 版本字符串。

- [ ] **Step 10：commit**

```bash
git add package.json package-lock.json docker-compose.yml .env.example .gitignore
git status   # 确认 data/ 删除被跟踪、.env.local 不在内
git commit -m "$(cat <<'EOF'
chore(db): swap better-sqlite3 for vercel postgres + docker compose

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

注意：`data/` 目录的删除如果之前没被 git 追踪（`.db` 文件常被 .gitignore），不会出现在 status；这没问题。

## Acceptance Criteria
1. `package.json` 和 `package-lock.json` 反映依赖变更
2. `docker-compose.yml` 存在，`docker compose ps` 显示 healthy postgres
3. `.env.local` 含 `POSTGRES_URL` 和 `CRON_SECRET`
4. `.env.example` 同样包含两条新 key 并有注释
5. `data/` 目录在文件系统已不存在
6. 单一 commit，working tree 干净
7. 此时 tsc 会**报错**（`lib/db/*.ts` 还引用 better-sqlite3 但包已删），这是预期的——下一个 task 修

---

## Task 2：新建 DB client + migrations 模块

**Files:**
- Modify (重写): `lib/db/client.ts`
- Create: `lib/db/migrations.ts`

- [ ] **Step 1：创建 `lib/db/migrations.ts`**

把原 `client.ts:11-110` 的 DDL 抽出来，改写为 PG 方言。完整文件：

```ts
import { db } from '@vercel/postgres'

const DDL = `
  CREATE TABLE IF NOT EXISTS collected_notes (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    keyword TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    author TEXT NOT NULL,
    author_id TEXT,
    author_avatar TEXT,
    author_red_id TEXT,
    url TEXT NOT NULL,
    cover_image TEXT,
    published_at TEXT NOT NULL,
    collected_at TEXT NOT NULL,
    likes INTEGER NOT NULL DEFAULT 0,
    comments INTEGER,
    shares INTEGER,
    views INTEGER NOT NULL DEFAULT 0,
    hot_score INTEGER NOT NULL DEFAULT 0,
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    raw JSONB NOT NULL DEFAULT '{}'::jsonb
  );
  CREATE INDEX IF NOT EXISTS idx_notes_cat_plat_date
    ON collected_notes (category_id, platform, published_at);
  CREATE INDEX IF NOT EXISTS idx_notes_keyword
    ON collected_notes (category_id, platform, keyword);

  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    created_at TEXT NOT NULL,
    accounts JSONB NOT NULL DEFAULT '[]'::jsonb
  );

  CREATE TABLE IF NOT EXISTS keyword_configs (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    value TEXT NOT NULL,
    platforms JSONB NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(category_id, value)
  );
  CREATE INDEX IF NOT EXISTS idx_keyword_configs_category
    ON keyword_configs(category_id);

  CREATE TABLE IF NOT EXISTS keyword_queries (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    keyword TEXT NOT NULL,
    platform TEXT NOT NULL,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    status TEXT NOT NULL,
    returned_count INTEGER NOT NULL DEFAULT 0,
    error_message TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_queries_category_started
    ON keyword_queries(category_id, started_at DESC);

  CREATE TABLE IF NOT EXISTS query_notes (
    query_id INTEGER NOT NULL REFERENCES keyword_queries(id) ON DELETE CASCADE,
    note_id TEXT NOT NULL REFERENCES collected_notes(id),
    hot_score_snapshot INTEGER,
    likes_snapshot INTEGER,
    comments_snapshot INTEGER,
    views_snapshot INTEGER,
    PRIMARY KEY (query_id, note_id)
  );
  CREATE INDEX IF NOT EXISTS idx_query_notes_note
    ON query_notes(note_id);

  CREATE TABLE IF NOT EXISTS note_summaries (
    note_id TEXT PRIMARY KEY REFERENCES collected_notes(id) ON DELETE CASCADE,
    summary TEXT NOT NULL,
    keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
    key_points JSONB NOT NULL DEFAULT '[]'::jsonb,
    highlights JSONB NOT NULL DEFAULT '[]'::jsonb,
    audience TEXT,
    model TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS topic_insights (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    generated_at TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('success','error')),
    error_message TEXT,
    source_note_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    insights JSONB NOT NULL DEFAULT '[]'::jsonb,
    model TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_topic_insights_cat_time
    ON topic_insights(category_id, generated_at DESC);
`

export async function applyMigrations(): Promise<void> {
  // db.query 接受多语句 SQL（pg 协议下可执行）
  await db.query(DDL)
}
```

- [ ] **Step 2：重写 `lib/db/client.ts`**

完整覆盖文件内容：

```ts
import { sql, db } from '@vercel/postgres'
import { applyMigrations } from './migrations'
import { seedIfEmpty } from './seed'

export { sql, db }

// 每个 lambda/process 实例只跑一次 migrations + seed
let _migrated: Promise<void> | null = null

export function ensureMigrated(): Promise<void> {
  if (_migrated) return _migrated
  _migrated = (async () => {
    await applyMigrations()
    await seedIfEmpty()
  })()
  return _migrated
}

// NoteRow 类型对应 collected_notes 表的一行；与 SQLite 版相比，
// JSONB 列（tags / raw）现在直接是 JS 值，不再是字符串
export type NoteRow = {
  id: string
  category_id: string
  platform: string
  keyword: string
  title: string
  summary: string
  author: string
  author_id: string | null
  author_avatar: string | null
  author_red_id: string | null
  url: string
  cover_image: string | null
  published_at: string
  collected_at: string
  likes: number
  comments: number | null
  shares: number | null
  views: number
  hot_score: number
  tags: string[]
  raw: Record<string, unknown>
}
```

- [ ] **Step 3：单独 tsc 校验客户端模块（其他文件还会报错，这正常）**

```bash
npx tsc --noEmit 2>&1 | grep "^lib/db/(client|migrations)" || echo "OK: client+migrations type-clean"
```

预期：`OK: client+migrations type-clean`。

- [ ] **Step 4：commit**

```bash
git add lib/db/client.ts lib/db/migrations.ts
git commit -m "$(cat <<'EOF'
feat(db): introduce postgres client and migrations module

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

## Acceptance Criteria
1. `lib/db/client.ts` 完全按 Step 2 内容
2. `lib/db/migrations.ts` 完全按 Step 1 内容
3. `lib/db/{client,migrations}` 自身无 tsc 错误
4. 单一 commit；package-lock 不应在 diff（已在 Task 1 提交）

---

## Task 3：重写 `lib/db/categories.ts`

**Files:**
- Modify (重写): `lib/db/categories.ts`

- [ ] **Step 1：完整覆盖文件**

```ts
import { db, sql, ensureMigrated } from './client'
import type { Category, KeywordConfig, MonitorSettings, Platform } from '@/lib/types'
import { CATEGORY_COLORS } from '@/lib/types'
import { today } from '@/lib/utils/dates'

type CategoryRow = {
  id: string
  name: string
  color: string
  created_at: string
  accounts: MonitorSettings['accounts']
}

type KeywordRow = {
  id: number
  category_id: string
  value: string
  platforms: Platform[]
  created_at: string
}

function rowToCategory(row: CategoryRow, keywords: KeywordConfig[]): Category {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    createdAt: row.created_at,
    settings: { keywords, accounts: row.accounts ?? [] },
  }
}

async function loadKeywordsFor(ids: string[]): Promise<Map<string, KeywordConfig[]>> {
  const out = new Map<string, KeywordConfig[]>()
  if (ids.length === 0) return out
  const { rows } = await db.query<KeywordRow>(
    `SELECT * FROM keyword_configs WHERE category_id = ANY($1::text[]) ORDER BY id`,
    [ids],
  )
  for (const id of ids) out.set(id, [])
  for (const r of rows) {
    out.get(r.category_id)!.push({ value: r.value, platforms: r.platforms })
  }
  return out
}

export async function listCategories(): Promise<Category[]> {
  await ensureMigrated()
  const { rows } = await sql<CategoryRow>`
    SELECT id, name, color, created_at, accounts
    FROM categories
    ORDER BY created_at, id
  `
  const kwMap = await loadKeywordsFor(rows.map((r) => r.id))
  return rows.map((r) => rowToCategory(r, kwMap.get(r.id) ?? []))
}

export async function getCategoryById(id: string): Promise<Category | undefined> {
  await ensureMigrated()
  const { rows } = await sql<CategoryRow>`
    SELECT id, name, color, created_at, accounts
    FROM categories
    WHERE id = ${id}
  `
  if (rows.length === 0) return undefined
  const kwMap = await loadKeywordsFor([id])
  return rowToCategory(rows[0], kwMap.get(id) ?? [])
}

export async function createCategory(
  input: { name: string; color?: string },
): Promise<Category> {
  await ensureMigrated()
  const { rows: countRows } = await sql<{ n: number }>`SELECT count(*)::int AS n FROM categories`
  const color = input.color ?? CATEGORY_COLORS[countRows[0].n % CATEGORY_COLORS.length]
  const id = `cat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const created_at = today()
  await sql`
    INSERT INTO categories (id, name, color, created_at, accounts)
    VALUES (${id}, ${input.name}, ${color}, ${created_at}, '[]'::jsonb)
  `
  return {
    id, name: input.name, color, createdAt: created_at,
    settings: { keywords: [], accounts: [] },
  }
}

export async function updateCategoryName(id: string, name: string): Promise<void> {
  await ensureMigrated()
  await sql`UPDATE categories SET name = ${name} WHERE id = ${id}`
}

export async function updateCategoryAccounts(
  id: string,
  accounts: MonitorSettings['accounts'],
): Promise<void> {
  await ensureMigrated()
  await sql`UPDATE categories SET accounts = ${JSON.stringify(accounts)}::jsonb WHERE id = ${id}`
}

export async function deleteCategory(id: string): Promise<void> {
  await ensureMigrated()
  await sql`DELETE FROM categories WHERE id = ${id}`
}

export async function replaceKeywords(
  categoryId: string,
  keywords: KeywordConfig[],
): Promise<void> {
  await ensureMigrated()
  const created_at = today()
  // PG 没有 SQLite 那种 db.transaction 包装；用显式 BEGIN/COMMIT
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    await client.query(`DELETE FROM keyword_configs WHERE category_id = $1`, [categoryId])
    for (const k of keywords) {
      await client.query(
        `INSERT INTO keyword_configs (category_id, value, platforms, created_at)
         VALUES ($1, $2, $3::jsonb, $4)`,
        [categoryId, k.value, JSON.stringify(k.platforms), created_at],
      )
    }
    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}
```

- [ ] **Step 2：tsc 校验本文件**

```bash
npx tsc --noEmit 2>&1 | grep "^lib/db/categories" || echo "OK"
```

预期：`OK`（lib/db/categories 无错；其它 db 文件还报错正常）

- [ ] **Step 3：commit**

```bash
git add lib/db/categories.ts
git commit -m "$(cat <<'EOF'
refactor(db): port categories to async postgres queries

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

## Acceptance Criteria
1. `lib/db/categories.ts` 内容完全按 Step 1
2. 文件自身无 tsc 错误
3. 函数签名匹配上文「DB 层接口契约」段
4. 单一 commit

---

## Task 4：重写 `lib/db/queries.ts`

**Files:**
- Modify (重写): `lib/db/queries.ts`

- [ ] **Step 1：完整覆盖文件**

```ts
import { db, sql, ensureMigrated } from './client'
import type { ContentItem, Platform } from '@/lib/types'

export type QueryStatus = 'success' | 'error'

export type QuerySummary = {
  id: number
  categoryId: string
  keyword: string
  platform: Platform
  startedAt: string
  finishedAt: string | null
  status: QueryStatus
  returnedCount: number
  errorMessage: string | null
}

export type NoteSnapshot = {
  hotScore: number | null
  likes: number | null
  comments: number | null
  views: number | null
}

export type QueryNote = ContentItem & { snapshot: NoteSnapshot }

export type QueryDetail = {
  query: QuerySummary
  notes: QueryNote[]
}

type QueryRow = {
  id: number
  category_id: string
  keyword: string
  platform: string
  started_at: string
  finished_at: string | null
  status: string
  returned_count: number
  error_message: string | null
}

function rowToSummary(r: QueryRow): QuerySummary {
  return {
    id: r.id,
    categoryId: r.category_id,
    keyword: r.keyword,
    platform: r.platform as Platform,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    status: r.status as QueryStatus,
    returnedCount: r.returned_count,
    errorMessage: r.error_message,
  }
}

export async function logQuerySuccess(input: {
  categoryId: string
  keyword: string
  platform: Platform
  startedAt: string
  finishedAt: string
  notes: Array<{
    noteId: string
    hotScore: number | null
    likes: number | null
    comments: number | null
    views: number | null
  }>
}): Promise<number> {
  await ensureMigrated()
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query<{ id: number }>(
      `INSERT INTO keyword_queries
         (category_id, keyword, platform, started_at, finished_at, status, returned_count)
       VALUES ($1, $2, $3, $4, $5, 'success', $6)
       RETURNING id`,
      [input.categoryId, input.keyword, input.platform,
       input.startedAt, input.finishedAt, input.notes.length],
    )
    const queryId = rows[0].id
    for (const n of input.notes) {
      await client.query(
        `INSERT INTO query_notes
           (query_id, note_id, hot_score_snapshot, likes_snapshot, comments_snapshot, views_snapshot)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (query_id, note_id) DO NOTHING`,
        [queryId, n.noteId, n.hotScore, n.likes, n.comments, n.views],
      )
    }
    await client.query('COMMIT')
    return queryId
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}

export async function logQueryError(input: {
  categoryId: string
  keyword: string
  platform: Platform
  startedAt: string
  finishedAt: string
  errorMessage: string
}): Promise<number> {
  await ensureMigrated()
  const { rows } = await sql<{ id: number }>`
    INSERT INTO keyword_queries
      (category_id, keyword, platform, started_at, finished_at, status,
       returned_count, error_message)
    VALUES (${input.categoryId}, ${input.keyword}, ${input.platform},
            ${input.startedAt}, ${input.finishedAt}, 'error', 0, ${input.errorMessage})
    RETURNING id
  `
  return rows[0].id
}

export type ListQueriesParams = {
  categoryId: string
  keyword?: string
  platform?: Platform
  status?: QueryStatus
  limit?: number
  cursor?: string
}

export type ListQueriesResult = {
  items: QuerySummary[]
  nextCursor?: string
}

function encodeCursor(startedAt: string, id: number): string {
  return Buffer.from(`${startedAt}|${id}`, 'utf8').toString('base64')
}

function decodeCursor(cursor: string): { startedAt: string; id: number } | null {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf8')
    const pipeIdx = decoded.lastIndexOf('|')
    if (pipeIdx === -1) return null
    const startedAt = decoded.slice(0, pipeIdx)
    const id = Number(decoded.slice(pipeIdx + 1))
    if (!startedAt || !Number.isFinite(id)) return null
    return { startedAt, id }
  } catch {
    return null
  }
}

export async function listQueries(
  params: ListQueriesParams,
): Promise<ListQueriesResult> {
  await ensureMigrated()
  const limit = Math.min(params.limit ?? 50, 200)
  const where: string[] = ['category_id = $1']
  const args: unknown[] = [params.categoryId]
  if (params.keyword) { args.push(params.keyword); where.push(`keyword = $${args.length}`) }
  if (params.platform) { args.push(params.platform); where.push(`platform = $${args.length}`) }
  if (params.status) { args.push(params.status); where.push(`status = $${args.length}`) }
  if (params.cursor) {
    const decoded = decodeCursor(params.cursor)
    if (decoded) {
      args.push(decoded.startedAt); const ai = args.length
      args.push(decoded.id);        const bi = args.length
      where.push(`(started_at, id) < ($${ai}, $${bi})`)
    }
  }
  args.push(limit + 1)
  const limitIdx = args.length

  const text = `
    SELECT * FROM keyword_queries
    WHERE ${where.join(' AND ')}
    ORDER BY started_at DESC, id DESC
    LIMIT $${limitIdx}
  `
  const { rows } = await db.query<QueryRow>(text, args)
  const items = rows.slice(0, limit).map(rowToSummary)
  const hasMore = rows.length > limit
  const nextCursor = hasMore
    ? encodeCursor(items[items.length - 1].startedAt, items[items.length - 1].id)
    : undefined
  return { items, nextCursor }
}

export async function getQueryWithNotes(queryId: number): Promise<QueryDetail | undefined> {
  await ensureMigrated()
  const { rows: qRows } = await sql<QueryRow>`SELECT * FROM keyword_queries WHERE id = ${queryId}`
  if (qRows.length === 0) return undefined
  const row = qRows[0]
  const { rows: notes } = await sql<Record<string, unknown>>`
    SELECT n.*, qn.hot_score_snapshot, qn.likes_snapshot, qn.comments_snapshot, qn.views_snapshot
    FROM query_notes qn
    JOIN collected_notes n ON n.id = qn.note_id
    WHERE qn.query_id = ${queryId}
    ORDER BY qn.hot_score_snapshot DESC NULLS LAST, n.id
  `
  const noteItems: QueryNote[] = notes.map((n) => ({
    id: String(n.id),
    categoryId: String(n.category_id),
    platform: String(n.platform) as Platform,
    title: String(n.title),
    summary: String(n.summary),
    author: String(n.author),
    publishedAt: String(n.published_at),
    collectedAt: String(n.collected_at),
    url: String(n.url),
    coverImage: n.cover_image == null ? undefined : String(n.cover_image),
    stats: {
      likes: Number(n.likes ?? 0),
      comments: n.comments == null ? undefined : Number(n.comments),
      shares: n.shares == null ? undefined : Number(n.shares),
      views: Number(n.views ?? 0),
    },
    hotScore: Number(n.hot_score ?? 0),
    // tags 已是 JSONB → JS 数组，不再 JSON.parse
    tags: (n.tags as string[]) ?? [],
    matchedBy: { type: 'keyword', value: row.keyword },
    snapshot: {
      hotScore: n.hot_score_snapshot == null ? null : Number(n.hot_score_snapshot),
      likes: n.likes_snapshot == null ? null : Number(n.likes_snapshot),
      comments: n.comments_snapshot == null ? null : Number(n.comments_snapshot),
      views: n.views_snapshot == null ? null : Number(n.views_snapshot),
    },
  }))
  return { query: rowToSummary(row), notes: noteItems }
}
```

- [ ] **Step 2：tsc 校验本文件**

```bash
npx tsc --noEmit 2>&1 | grep "^lib/db/queries" || echo "OK"
```

预期：`OK`。

- [ ] **Step 3：commit**

```bash
git add lib/db/queries.ts
git commit -m "$(cat <<'EOF'
refactor(db): port queries to async postgres with parametrized SQL

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

## Acceptance Criteria
1. 文件内容按 Step 1
2. 自身无 tsc 错误
3. 单一 commit

---

## Task 5：重写 `lib/db/insights.ts`

**Files:**
- Modify (重写): `lib/db/insights.ts`

- [ ] **Step 1：完整覆盖文件**

```ts
import { sql, ensureMigrated } from './client'
import type { InsightSnapshot, NoteSummary, TopicInsight } from '@/lib/types'

type NoteSummaryRow = {
  note_id: string
  summary: string
  keywords: string[]
  key_points: string[]
  highlights: string[]
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
  source_note_ids: string[]
  insights: TopicInsight[]
  model: string
}

function rowToSummary(r: NoteSummaryRow): NoteSummary {
  return {
    noteId: r.note_id,
    summary: r.summary,
    keywords: r.keywords ?? [],
    keyPoints: r.key_points ?? [],
    highlights: r.highlights ?? [],
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
    sourceNoteIds: r.source_note_ids ?? [],
    insights: r.insights ?? [],
    model: r.model,
  }
}

export async function upsertNoteSummary(
  s: NoteSummary & { model: string },
): Promise<void> {
  await ensureMigrated()
  await sql`
    INSERT INTO note_summaries
      (note_id, summary, keywords, key_points, highlights, audience, model, created_at)
    VALUES (
      ${s.noteId}, ${s.summary},
      ${JSON.stringify(s.keywords)}::jsonb,
      ${JSON.stringify(s.keyPoints)}::jsonb,
      ${JSON.stringify(s.highlights)}::jsonb,
      ${s.audience ?? null},
      ${s.model},
      ${new Date().toISOString()}
    )
    ON CONFLICT (note_id) DO NOTHING
  `
}

export async function getNoteSummaries(
  noteIds: string[],
): Promise<Map<string, NoteSummary>> {
  await ensureMigrated()
  const out = new Map<string, NoteSummary>()
  if (noteIds.length === 0) return out
  const { rows } = await sql<NoteSummaryRow>`
    SELECT * FROM note_summaries WHERE note_id = ANY(${noteIds}::text[])
  `
  for (const r of rows) out.set(r.note_id, rowToSummary(r))
  return out
}

export async function insertInsightSnapshot(input: {
  categoryId: string
  generatedAt: string
  status: 'success' | 'error'
  errorMessage?: string
  sourceNoteIds: string[]
  insights: TopicInsight[]
  model: string
}): Promise<number> {
  await ensureMigrated()
  const { rows } = await sql<{ id: number }>`
    INSERT INTO topic_insights
      (category_id, generated_at, status, error_message,
       source_note_ids, insights, model)
    VALUES (
      ${input.categoryId}, ${input.generatedAt}, ${input.status},
      ${input.errorMessage ?? null},
      ${JSON.stringify(input.sourceNoteIds)}::jsonb,
      ${JSON.stringify(input.insights)}::jsonb,
      ${input.model}
    )
    RETURNING id
  `
  return rows[0].id
}

export async function getInsightSnapshot(id: number): Promise<InsightSnapshot | undefined> {
  await ensureMigrated()
  const { rows } = await sql<InsightRow>`SELECT * FROM topic_insights WHERE id = ${id}`
  return rows.length === 0 ? undefined : rowToSnapshot(rows[0])
}

export async function getLatestInsightSnapshot(
  categoryId: string,
): Promise<InsightSnapshot | undefined> {
  await ensureMigrated()
  const { rows } = await sql<InsightRow>`
    SELECT * FROM topic_insights
    WHERE category_id = ${categoryId}
    ORDER BY generated_at DESC, id DESC
    LIMIT 1
  `
  return rows.length === 0 ? undefined : rowToSnapshot(rows[0])
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

export async function listInsightSnapshots(params: {
  categoryId: string
  limit?: number
  cursor?: string
}): Promise<{ items: InsightSnapshot[]; nextCursor?: string }> {
  await ensureMigrated()
  const limit = Math.min(params.limit ?? 20, 100)
  const decoded = params.cursor ? decodeCursor(params.cursor) : null

  const { rows } = decoded
    ? await sql<InsightRow>`
        SELECT * FROM topic_insights
        WHERE category_id = ${params.categoryId}
          AND (generated_at, id) < (${decoded.generatedAt}, ${decoded.id})
        ORDER BY generated_at DESC, id DESC
        LIMIT ${limit + 1}
      `
    : await sql<InsightRow>`
        SELECT * FROM topic_insights
        WHERE category_id = ${params.categoryId}
        ORDER BY generated_at DESC, id DESC
        LIMIT ${limit + 1}
      `

  const items = rows.slice(0, limit).map(rowToSnapshot)
  const hasMore = rows.length > limit
  const nextCursor = hasMore
    ? encodeCursor(items[items.length - 1].generatedAt, items[items.length - 1].id)
    : undefined
  return { items, nextCursor }
}
```

- [ ] **Step 2：tsc 校验**

```bash
npx tsc --noEmit 2>&1 | grep "^lib/db/insights" || echo "OK"
```

- [ ] **Step 3：commit**

```bash
git add lib/db/insights.ts
git commit -m "$(cat <<'EOF'
refactor(db): port insights to async postgres with JSONB

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

## Acceptance Criteria
1. 文件内容按 Step 1
2. 自身无 tsc 错误
3. 单一 commit

---

## Task 6：重写 `lib/db/seed.ts`

**Files:**
- Modify (重写): `lib/db/seed.ts`

- [ ] **Step 1：完整覆盖文件**

```ts
import { db, sql } from './client'
import { CATEGORIES_SEED } from '@/lib/fixtures/categories'

export async function seedIfEmpty(): Promise<void> {
  const { rows } = await sql<{ n: number }>`SELECT count(*)::int AS n FROM categories`
  if (rows[0].n > 0) return

  const client = await db.connect()
  try {
    await client.query('BEGIN')
    for (const c of CATEGORIES_SEED) {
      await client.query(
        `INSERT INTO categories (id, name, color, created_at, accounts)
         VALUES ($1, $2, $3, $4, $5::jsonb)
         ON CONFLICT (id) DO NOTHING`,
        [c.id, c.name, c.color, c.createdAt, JSON.stringify(c.settings.accounts ?? [])],
      )
      for (const k of c.settings.keywords) {
        await client.query(
          `INSERT INTO keyword_configs (category_id, value, platforms, created_at)
           VALUES ($1, $2, $3::jsonb, $4)
           ON CONFLICT (category_id, value) DO NOTHING`,
          [c.id, k.value, JSON.stringify(k.platforms), c.createdAt],
        )
      }
    }
    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}
```

注意：函数不再调用 `ensureMigrated()`（避免循环依赖；migrations 必须在 seed 前已执行——`client.ts:ensureMigrated()` 顺序保证）。

- [ ] **Step 2：tsc 整体校验 lib/db**

```bash
npx tsc --noEmit 2>&1 | grep "^lib/db/" || echo "OK: lib/db type-clean"
```

预期：`OK: lib/db type-clean`。整个 db 层应已类型干净，但 caller 还会报 await 缺失等错误。

- [ ] **Step 3：commit**

```bash
git add lib/db/seed.ts
git commit -m "$(cat <<'EOF'
refactor(db): port seed to async postgres with ON CONFLICT

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

## Acceptance Criteria
1. 文件内容按 Step 1
2. `lib/db/` 整层无 tsc 错误
3. 单一 commit

---

## Task 7：更新 13 个 API route consumer

**Files:** （全部 modify）
- `app/(monitor)/c/[categoryId]/layout.tsx`
- `app/api/categories/route.ts`
- `app/api/categories/[id]/route.ts`
- `app/api/categories/[id]/keywords/route.ts`
- `app/api/cron/daily-insights/route.ts`
- `app/api/insights/route.ts`
- `app/api/insights/[id]/route.ts`
- `app/api/insights/latest/route.ts`
- `app/api/insights/generate/route.ts`
- `app/api/insights/generate-by-keyword/route.ts`
- `app/api/notes/route.ts`
- `app/api/queries/route.ts`
- `app/api/queries/[id]/route.ts`
- `app/api/wechat/search/route.ts`
- `app/api/xhs/collect/route.ts`

每个文件做这些机械改动：
1. 删除 `import { getDb, ... } from '@/lib/db/client'` 中的 `getDb`（如还需 `NoteRow` 等类型则保留 import）
2. 删除 `const db = getDb()` 这一行
3. 凡是调用 `lib/db/{categories,queries,insights,seed}` 的函数，去掉首个 `db` 参数，并在前面加 `await`
4. 例：`const items = listCategories(db)` → `const items = await listCategories()`
5. 例：`logQuerySuccess(db, { ... })` → `await logQuerySuccess({ ... })`

- [ ] **Step 1：用 grep 列出所有 caller 改动点**

```bash
grep -rn "getDb()\|listCategories(db\|getCategoryById(db\|createCategory(db\|updateCategoryName(db\|updateCategoryAccounts(db\|deleteCategory(db\|replaceKeywords(db\|logQuerySuccess(db\|logQueryError(db\|listQueries(db\|getQueryWithNotes(db\|upsertNoteSummary(db\|getNoteSummaries(db\|insertInsightSnapshot(db\|getInsightSnapshot(db\|getLatestInsightSnapshot(db\|listInsightSnapshots(db\|seedIfEmpty(db" app/ lib/data/ 2>/dev/null | tee /tmp/db-callers.txt
```

记录下行数。预期 ~25-35 处。

- [ ] **Step 2：逐文件改写**

对每个文件用 Edit 工具：

**Pattern A — 单调用：**

before:
```ts
const db = getDb()
const items = listCategories(db)
```

after:
```ts
const items = await listCategories()
```

**Pattern B — 多调用，复用 db 变量：**

before:
```ts
const db = getDb()
const cat = getCategoryById(db, id)
if (!cat) return ...
replaceKeywords(db, id, keywords)
```

after:
```ts
const cat = await getCategoryById(id)
if (!cat) return ...
await replaceKeywords(id, keywords)
```

**Pattern C — `getDb()` 返回值传入工具函数（少见但可能存在）：**

如果发现某文件把 `getDb()` 返回值传给了 `runInsightsPipeline(db, ...)` 之类的内部函数，需要先把那个内部函数也改成不接受 db。检查 `app/api/insights/generate/route.ts` 是否 export 了 `runInsightsPipeline`，是的话同样去掉首参。

具体行号靠 Step 1 的 grep 输出锁定。

- [ ] **Step 3：检查 `lib/data/*.ts`**

```bash
grep -rn "getDb()\|from '@/lib/db/" lib/data/ 2>/dev/null
```

如果有 `lib/data/*.ts` 文件 import `lib/db/*`，按相同方式 sprinkle await。当前 `lib/data/*.ts` 用的是 fixtures，可能没有 db 调用——若 grep 为空则跳过。

- [ ] **Step 4：tsc 校验全仓**

```bash
npx tsc --noEmit
```

预期：0 错误。如果还有 await-related 错误（`Type 'Promise<X>' is not assignable to ...`），按报错位置补 await。

- [ ] **Step 5：dev server 烟雾测试**

```bash
docker compose ps    # 确保 postgres healthy
npm run dev > /tmp/next-dev.log 2>&1 &
sleep 8
curl -s -o /dev/null -w "GET / HTTP:%{http_code}\n" http://localhost:3000/
curl -s -o /dev/null -w "GET /api/categories HTTP:%{http_code}\n" http://localhost:3000/api/categories
curl -s "http://localhost:3000/api/categories" | head -c 500
pkill -f "next dev"
```

预期：
- `GET / HTTP:307`（redirect 到首个分类）
- `GET /api/categories HTTP:200`
- 返回 JSON 含 6 个 seed 分类（claudecode 等）

如果失败，看 `/tmp/next-dev.log` 里的 stack trace，按错修。

- [ ] **Step 6：commit**

```bash
git add app/ lib/data/
git commit -m "$(cat <<'EOF'
refactor(api): await db calls and drop getDb() pattern

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

## Acceptance Criteria
1. 所有 13 个 API route 文件 + `lib/data/*` 中再无 `getDb()` 调用、再无 `(db,` 调用
2. `npx tsc --noEmit` 0 错误
3. dev server 烟雾测试三个 curl 全 200/307
4. seed 进去的 6 个分类可被 `/api/categories` 列出
5. 单一 commit

---

## Task 8：vitest 单 fork + truncate helper

> **与 spec 的差异**：spec 提的是「schema-per-file」隔离，plan 改用「单 fork + per-test TRUNCATE」。
> 原因：测试只有 6 个文件、毫秒级跑完，TRUNCATE 比 CREATE/DROP SCHEMA 简单一个数量级，且不需要每个测试文件 import schema setup helper。
> 取舍：失去并行能力，但本规模无影响。如未来 db 测试增长到 20+ 文件可再回切 schema 隔离。

**Files:**
- Modify: `vitest.config.ts`
- Create: `tests/db/_helpers.ts`

- [ ] **Step 1：修改 `vitest.config.ts`**

读 `vitest.config.ts`。把 monitor project 的 test 块改为：

```ts
{
  plugins: [],
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
  test: {
    name: 'monitor',
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
},
```

新增的两行：`pool: 'forks'` + `poolOptions: { forks: { singleFork: true } }`。这让 monitor 项目里所有 test files 在一个 fork 里串行执行，避免并发 truncate 互相打架。

studio project 不动。

- [ ] **Step 2：创建 `tests/db/_helpers.ts`**

```ts
import { sql, db } from '@/lib/db/client'
import { applyMigrations } from '@/lib/db/migrations'

let migrated = false

export async function ensureSchema(): Promise<void> {
  if (migrated) return
  await applyMigrations()
  migrated = true
}

/**
 * 在每个测试 beforeEach 调一次，清空所有业务表。
 * 顺序按 FK 依赖：先删 child 表，再删 parent 表。
 * categories 是 root；不删它意味着 seed 可能残留——所以也清掉，由测试自己建。
 */
export async function truncateAll(): Promise<void> {
  await ensureSchema()
  // RESTART IDENTITY 把 SERIAL/IDENTITY 重置为 1
  // CASCADE 顺带处理依赖，避免顺序问题
  await db.query(`
    TRUNCATE TABLE
      query_notes,
      keyword_queries,
      note_summaries,
      topic_insights,
      keyword_configs,
      collected_notes,
      categories
    RESTART IDENTITY CASCADE
  `)
}

/**
 * 给测试用的"空 db"——seed 会被绕过（因为 categories 表非空判断）。
 * 测试如果想要 seed 数据，自己手动调用 seedIfEmpty()。
 */
export async function resetDb(): Promise<void> {
  await truncateAll()
}
```

- [ ] **Step 3：tsc 校验**

```bash
npx tsc --noEmit 2>&1 | grep "tests/db/_helpers" || echo "OK"
```

- [ ] **Step 4：commit**

```bash
git add vitest.config.ts tests/db/_helpers.ts
git commit -m "$(cat <<'EOF'
test(db): single-fork monitor project + truncate helper

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

## Acceptance Criteria
1. `vitest.config.ts` monitor 项目添加了两行 fork 配置
2. `tests/db/_helpers.ts` 完整存在
3. tsc 干净
4. 单一 commit

---

## Task 9：重写 6 个 db 测试文件

**Files:** （全部 modify）
- `tests/db/schema.test.ts`
- `tests/db/categories.test.ts`
- `tests/db/queries.test.ts`
- `tests/db/insights.test.ts`
- `tests/db/insights-schema.test.ts`
- `tests/db/seed.test.ts`

每个测试文件改造规则：
1. 删除所有 `import Database from 'better-sqlite3'`、`import { getDb } from '...'`、`new Database(':memory:')`
2. 测试一开头 `beforeEach(async () => { await truncateAll() })` 或 `beforeAll(async () => { await ensureSchema() })`
3. 所有 `db.prepare(...)` / `db.exec(...)` 改用 `lib/db/client` 的 `sql` 或 `db.query`
4. 所有 lib/db 函数调用去掉首参 db 并加 await

- [ ] **Step 1：先看现有测试结构**

```bash
head -30 tests/db/schema.test.ts tests/db/categories.test.ts tests/db/queries.test.ts tests/db/insights.test.ts tests/db/insights-schema.test.ts tests/db/seed.test.ts
```

把每个文件的 setup pattern 看清楚。它们大概率是 `beforeEach` 里造一个 in-memory SQLite。

- [ ] **Step 2：改写每个文件**

每个文件用相似 pattern。以 `tests/db/categories.test.ts` 为例（按现有逻辑等价改写）：

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { truncateAll, ensureSchema } from './_helpers'
import {
  listCategories,
  getCategoryById,
  createCategory,
  updateCategoryName,
  deleteCategory,
  replaceKeywords,
} from '@/lib/db/categories'

beforeEach(async () => {
  await ensureSchema()
  await truncateAll()
})

describe('lib/db/categories', () => {
  it('lists empty when no rows', async () => {
    const items = await listCategories()
    expect(items).toEqual([])
  })

  it('creates and retrieves a category', async () => {
    const created = await createCategory({ name: 'test cat' })
    expect(created.name).toBe('test cat')
    const got = await getCategoryById(created.id)
    expect(got?.name).toBe('test cat')
  })

  // ... 保留原有断言，全部加 await
})
```

**改写策略**：
- 保留每个 `it()` 的断言意图（不改变测试语义）
- 把所有 sync 调用改为 async
- 移除任何对 better-sqlite3 实现细节的依赖（如 `lastInsertRowid`、`changes`、prepared statement 复用）
- 如果原测试有用 `db.prepare("SELECT ...")` 直接断言表内容，改用：
  ```ts
  import { sql } from '@/lib/db/client'
  const { rows } = await sql`SELECT * FROM categories WHERE id = ${id}`
  expect(rows.length).toBe(1)
  ```

对 6 个文件分别这样改写。**关键约束**：保留原 `it()` 名称和断言数量；只改实现细节。

- [ ] **Step 3：跑 monitor 测试**

```bash
docker compose ps    # 确保 postgres healthy
npx vitest run --project monitor
```

预期：所有测试通过。失败定位：
- 类型错误：tsc + vitest 都会报，按报错修
- 语义错误：比对原 sqlite 行为；JSONB 反序列化的 null vs undefined 边界要小心
- 数据断言失败：truncate 是否在每个 it 前都跑了？

- [ ] **Step 4：跑全套测试（monitor + studio）**

```bash
npm run test
```

预期：18 files / 106+ tests 全过（具体数字因测试改写微调）。

- [ ] **Step 5：commit**

```bash
git add tests/db/
git commit -m "$(cat <<'EOF'
test(db): port db tests to async postgres with truncate isolation

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

## Acceptance Criteria
1. 6 个 db 测试文件已改造，无 better-sqlite3 引用
2. `npx vitest run --project monitor` 全过
3. `npm run test` 全过
4. 单一 commit

---

## Task 10：本地 build + README 文档

**Files:**
- Modify: `README.md`

- [ ] **Step 1：跑生产 build**

```bash
docker compose ps    # 确保 postgres healthy
npm run build 2>&1 | tail -40
```

预期：build 成功，路由表显示 monitor + studio 全部路由。如果失败按错修。

- [ ] **Step 2：更新 `README.md`**

找到「快速开始」段并替换为：

```md
## 快速开始

```bash
npm install
docker compose up -d              # 起本地 Postgres，首次会拉镜像
cp .env.example .env.local        # 填入各 API key（参考下方"环境变量"）
npm run dev
```

访问 http://localhost:3000

## 环境变量

| Key | 用途 |
|---|---|
| `POSTGRES_URL` | 数据库连接（本地 docker 默认 `postgres://dev:dev@localhost:5432/content_factory`；生产由 Vercel Postgres 自动注入） |
| `WECHAT_SEARCH_API_KEY` / `WECHAT_SEARCH_API_URL` | 采集侧公众号关键词搜索 |
| `LLM_PROVIDER` / `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` | 采集侧选题分析（OpenAI 兼容协议） |
| `SILICONFLOW_API_KEY` / `SILICONFLOW_BASE_URL` / `SILICONFLOW_MODEL` | 创作侧多平台生成 |
| `WECHAT_API_KEY` / `WECHAT_API_BASE_URL` | 创作侧公众号一键发布 |
| `CRON_SECRET` | 保护 `/api/cron/daily-insights` 端点（手动触发时用） |

## 数据库初始化

首次访问任意 API 路由时会自动建表 + seed 6 个示例分类，无需手动迁移。

## 测试

```bash
docker compose up -d   # postgres 必须已起
npm run test           # monitor (node) + studio (jsdom) 双 environment
```

## 生产部署

部署到 Vercel：
1. push 代码到 GitHub
2. Vercel → Import Project
3. Storage → Create Postgres → 自动注入 `POSTGRES_URL`
4. Environment Variables 加上述其余 keys
5. Deploy
```

- [ ] **Step 3：commit**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
docs(readme): document docker postgres setup and env vars

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

## Acceptance Criteria
1. `npm run build` 成功
2. README 反映新的本地启动流程
3. 单一 commit

---

## Task 11：push 到 GitHub `main`

**Files:** 不改文件，纯 git 操作

- [ ] **Step 1：添加远端**

```bash
cd /Users/yves/ai编程项目/内容工厂采集与分析
git remote -v
```

如果已有 `origin` 指向其他地方，先 `git remote remove origin`。

```bash
git remote add origin https://github.com/Sejourleo/AI-Project-factory.git
git remote -v
```

预期：显示 `origin  https://github.com/Sejourleo/AI-Project-factory.git (fetch/push)`。

- [ ] **Step 2：检查认证**

```bash
git ls-remote origin 2>&1 | head -3
```

如果是空仓 → 输出空（无 refs）但无报错，OK。
如果报 `fatal: could not read Username` → 用户需要先配置 GitHub credential helper 或 SSH key。停下来告诉用户。
如果报 `Authentication failed` → 同上。

- [ ] **Step 3：push 当前分支为远端 main**

```bash
git push -u origin feat/prototype:main
```

`-u` 让本地 feat/prototype 的 upstream = origin/main。后续 `git push` / `git pull` 都简单。

预期输出：
```
Enumerating objects: ...
Writing objects: ...
remote: Resolving deltas: ...
To https://github.com/Sejourleo/AI-Project-factory.git
 * [new branch]      feat/prototype -> main
Branch 'feat/prototype' set up to track 'origin/main'.
```

如果 push 被拒（`! [rejected] feat/prototype -> main (fetch first)`），说明远端 main 已经有内容（不是空仓）。停下报告 BLOCKED；不要 force push。

- [ ] **Step 4：验证**

```bash
git ls-remote origin main
```

预期：显示一个 SHA，等于本地 `git rev-parse feat/prototype` 的输出。

## Acceptance Criteria
1. `git remote -v` 显示 origin = AI-Project-factory
2. `origin/main` 存在并指向本地 HEAD
3. 浏览器访问 https://github.com/Sejourleo/AI-Project-factory 看得到代码

---

## Task 12：Vercel 部署 walkthrough（用户在浏览器执行）

**Files:** 不改文件；纯文档输出

- [ ] **Step 1：把以下指引完整发给用户**

```
🚀 Vercel 部署步骤（你在浏览器里点）

1. 登录 https://vercel.com（用你的 GitHub 账号）

2. 点 "Add New..." → "Project"
   - 找到并 import: Sejourleo/AI-Project-factory
   - Framework Preset: Next.js（自动识别）
   - Root Directory: 默认 ./（不动）
   - Build Command: 默认 next build（不动）

3. **暂时不要点 Deploy**。先在 "Environment Variables" 区域加：

   WECHAT_SEARCH_API_KEY      = <你的值>
   WECHAT_SEARCH_API_URL      = <你的值>
   LLM_PROVIDER               = openai
   LLM_BASE_URL               = https://api.openai.com
   LLM_API_KEY                = sk-...
   LLM_MODEL                  = gpt-4o-mini
   SILICONFLOW_API_KEY        = sk-...
   SILICONFLOW_BASE_URL       = https://api.siliconflow.cn/v1
   SILICONFLOW_MODEL          = Pro/moonshotai/Kimi-K2-Instruct-0905
   WECHAT_API_KEY             = xhs_...
   WECHAT_API_BASE_URL        = https://wx.limyai.com/api/openapi
   CRON_SECRET                = <随便一段长字符串>

   值从你本地的 .env.local 复制过来。

4. 点 "Deploy"。第一次会失败！因为还没接 Postgres——这是预期的，看下一步。

5. 部署面板顶部 → "Storage" tab → "Create Database"
   - 选 "Postgres"
   - Region 选离你近的（Tokyo / Singapore / Hong Kong）
   - 点 "Create & Connect"
   - Vercel 会自动注入 6 个 POSTGRES_* env 到项目（包括 POSTGRES_URL）

6. 回到 Deployments tab → 找到失败的那次部署 → 右上角三点 → "Redeploy"
   - 这次会成功

7. 部署成功后 → 点 "Visit"，看到 / 自动跳转到首个分类页

8. 烟雾测试（替换 <your-domain> 为 Vercel 给的 URL）：
   curl -s -o /dev/null -w "%{http_code}\n" https://<your-domain>/
   curl -s -o /dev/null -w "%{http_code}\n" https://<your-domain>/api/categories
   curl -s -o /dev/null -w "%{http_code}\n" https://<your-domain>/studio
   curl -s -X POST https://<your-domain>/api/studio/wechat/accounts | head -c 200

   全 200/307 才算成功。

9. 手动触发 cron（可选）：
   curl -H "Authorization: Bearer <你的 CRON_SECRET>" https://<your-domain>/api/cron/daily-insights

如果遇到 build 失败 / runtime 报错，把 Vercel "Build Logs" 或 "Function Logs"
的报错截图/复制给我，我帮你排查。
```

## Acceptance Criteria
1. 用户拿到上述指引
2. 用户在浏览器完成部署，能访问 https://<your-domain>/
3. 创作 / 采集两侧主路径在生产环境都能跑通

---

## 收尾说明

- 所有 11 个代码 task 完成后，本地仓库状态：feat/prototype 上叠加 ~11 个 commits
- 远端 main 有完整代码
- Vercel 部署完成后，分享 URL 给用户
- 后续再开发可继续在 feat/prototype 工作；push 到 origin/main 触发 Vercel 自动重新部署
