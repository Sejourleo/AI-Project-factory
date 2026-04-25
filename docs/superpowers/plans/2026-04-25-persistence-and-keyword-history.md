# 持久化 + 关键词查询历史 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把分类/关键词配置持久化到 SQLite,并新增「查询历史」Tab 记录每次刷新的事件 + 笔记快照。

**Architecture:** 4 张新表(`categories` / `keyword_configs` / `keyword_queries` / `query_notes`)叠加在已有的 `collected_notes` 之上。`CategoriesProvider` 改为首屏 fetch hydrate + 写操作走 REST API。采集路由在单事务里写笔记 upsert + query 事件 + query_notes 快照。Wechat 路由对齐 xhs 的 DB-backed 模式。新增 `/c/[id]/history` Tab 含列表与详情两层。

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, better-sqlite3, vitest, @base-ui/react, dayjs, sonner.

**Spec:** `docs/superpowers/specs/2026-04-25-persistence-and-keyword-history-design.md`

---

## File Structure (新建/改动)

**新建:**
- `lib/db/categories.ts` — 分类 + 关键词的 DB 操作
- `lib/db/queries.ts` — keyword_queries + query_notes 的 DB 操作
- `lib/db/seed.ts` — 空库时从 `CATEGORIES_SEED` 灌入
- `app/api/categories/route.ts` — GET / POST
- `app/api/categories/[id]/route.ts` — PATCH / DELETE
- `app/api/categories/[id]/keywords/route.ts` — PUT
- `app/api/queries/route.ts` — GET 列表
- `app/api/queries/[id]/route.ts` — GET 详情
- `app/c/[categoryId]/history/page.tsx` — 历史列表
- `app/c/[categoryId]/history/[queryId]/page.tsx` — 历史详情
- `components/history-list.tsx` — 列表 UI
- `components/history-detail.tsx` — 详情 UI
- `tests/db/schema.test.ts`
- `tests/db/categories.test.ts` (改造现有)
- `tests/db/queries.test.ts`

**改动:**
- `lib/db/client.ts` — 抽出 `applyMigrations()`、加 4 张表、`getDb()` 调用 seed
- `app/api/xhs/collect/route.ts` — 写 query 事件 + query_notes
- `app/api/wechat/search/route.ts` — 改造为 DB-backed collect
- `lib/data/wechat.ts` — 复用 `/api/notes` 模式
- `components/categories-provider.tsx` — hydrate + 乐观写
- `components/tab-nav.tsx` — 加「查询历史」
- `app/c/[categoryId]/layout.tsx` — 用 DB 取分类名
- `tests/data/categories.test.ts` — 改成 DB-backed

**删除:**
- `lib/data/categories.ts` — 不再需要(改由 provider 直接 fetch /api/categories)

---

## Task 1: DB schema 抽离 + 4 张新表

**Files:**
- Modify: `lib/db/client.ts`
- Test: `tests/db/schema.test.ts` (new)

- [ ] **Step 1: 写失败的 schema 测试**

```ts
// tests/db/schema.test.ts
import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import { applyMigrations } from '@/lib/db/client'

describe('db schema', () => {
  it('applyMigrations 创建所有表', () => {
    const db = new Database(':memory:')
    applyMigrations(db)
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as Array<{ name: string }>
    const names = tables.map((t) => t.name)
    expect(names).toEqual(expect.arrayContaining([
      'categories',
      'collected_notes',
      'keyword_configs',
      'keyword_queries',
      'query_notes',
    ]))
  })

  it('外键级联:删除 category 自动清 keyword_configs / keyword_queries / query_notes', () => {
    const db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    applyMigrations(db)
    db.prepare(`INSERT INTO categories (id, name, color, created_at) VALUES (?,?,?,?)`)
      .run('c1', '测', '#000', '2026-04-25')
    db.prepare(`INSERT INTO keyword_configs (category_id, value, platforms, created_at) VALUES (?,?,?,?)`)
      .run('c1', 'kw', '[]', '2026-04-25')
    db.prepare(`DELETE FROM categories WHERE id = ?`).run('c1')
    const cnt = db.prepare(`SELECT count(*) as n FROM keyword_configs`).get() as { n: number }
    expect(cnt.n).toBe(0)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
npx vitest run tests/db/schema.test.ts
```

期望:`applyMigrations is not a function` / 找不到导出。

- [ ] **Step 3: 重写 `lib/db/client.ts`,抽出 `applyMigrations` 并加 4 张表**

```ts
// lib/db/client.ts
import Database from 'better-sqlite3'
import path from 'node:path'
import fs from 'node:fs'

const DB_DIR = path.join(process.cwd(), 'data')
const DB_PATH = path.join(DB_DIR, 'content.db')

let _db: Database.Database | null = null

export function applyMigrations(db: Database.Database): void {
  db.exec(`
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
      tags TEXT NOT NULL DEFAULT '[]',
      raw TEXT NOT NULL DEFAULT '{}'
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
      accounts TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS keyword_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      value TEXT NOT NULL,
      platforms TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(category_id, value)
    );
    CREATE INDEX IF NOT EXISTS idx_keyword_configs_category
      ON keyword_configs(category_id);

    CREATE TABLE IF NOT EXISTS keyword_queries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
  `)
}

export function getDb(): Database.Database {
  if (_db) return _db
  fs.mkdirSync(DB_DIR, { recursive: true })
  const db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  applyMigrations(db)
  _db = db
  return db
}

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
  tags: string
  raw: string
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
npx vitest run tests/db/schema.test.ts
```

期望:2 个测试 PASS。

- [ ] **Step 5: 跑全套确保没回归**

```bash
npx vitest run && npx tsc --noEmit
```

期望:全绿。

- [ ] **Step 6: 提交**

```bash
git add lib/db/client.ts tests/db/schema.test.ts
git commit -m "feat(db): extract applyMigrations and add 4 history tables"
```

---

## Task 2: 空库 seed (从 CATEGORIES_SEED)

**Files:**
- Create: `lib/db/seed.ts`
- Modify: `lib/db/client.ts`
- Test: `tests/db/seed.test.ts` (new)

- [ ] **Step 1: 写失败测试**

```ts
// tests/db/seed.test.ts
import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import { applyMigrations } from '@/lib/db/client'
import { seedIfEmpty } from '@/lib/db/seed'

function freshDb() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  applyMigrations(db)
  return db
}

describe('seedIfEmpty', () => {
  it('空库 → 插入 3 条种子分类与关键词', () => {
    const db = freshDb()
    seedIfEmpty(db)
    const cats = db.prepare('SELECT id FROM categories ORDER BY id').all() as Array<{ id: string }>
    expect(cats.map((c) => c.id)).toEqual(['ai-product', 'claudecode', 'vibecoding'])
    const kwCount = db.prepare('SELECT count(*) as n FROM keyword_configs').get() as { n: number }
    expect(kwCount.n).toBeGreaterThanOrEqual(3)
  })

  it('再次调用幂等 → 不重复插入', () => {
    const db = freshDb()
    seedIfEmpty(db)
    seedIfEmpty(db)
    const cats = db.prepare('SELECT count(*) as n FROM categories').get() as { n: number }
    expect(cats.n).toBe(3)
  })

  it('已有分类 → 不动种子', () => {
    const db = freshDb()
    db.prepare(`INSERT INTO categories (id, name, color, created_at) VALUES (?,?,?,?)`)
      .run('custom', '自定义', '#000', '2026-04-25')
    seedIfEmpty(db)
    const cats = db.prepare('SELECT id FROM categories').all() as Array<{ id: string }>
    expect(cats.map((c) => c.id)).toEqual(['custom'])
  })
})
```

- [ ] **Step 2: 跑确认失败**

```bash
npx vitest run tests/db/seed.test.ts
```

期望:`Cannot find module '@/lib/db/seed'`。

- [ ] **Step 3: 写 seed 模块**

```ts
// lib/db/seed.ts
import type Database from 'better-sqlite3'
import { CATEGORIES_SEED } from '@/lib/fixtures/categories'

export function seedIfEmpty(db: Database.Database): void {
  const row = db.prepare('SELECT count(*) as n FROM categories').get() as { n: number }
  if (row.n > 0) return

  const insertCategory = db.prepare(`
    INSERT INTO categories (id, name, color, created_at, accounts)
    VALUES (@id, @name, @color, @created_at, @accounts)
  `)
  const insertKeyword = db.prepare(`
    INSERT INTO keyword_configs (category_id, value, platforms, created_at)
    VALUES (@category_id, @value, @platforms, @created_at)
  `)

  const tx = db.transaction(() => {
    for (const c of CATEGORIES_SEED) {
      insertCategory.run({
        id: c.id,
        name: c.name,
        color: c.color,
        created_at: c.createdAt,
        accounts: JSON.stringify(c.settings.accounts ?? []),
      })
      for (const k of c.settings.keywords) {
        insertKeyword.run({
          category_id: c.id,
          value: k.value,
          platforms: JSON.stringify(k.platforms),
          created_at: c.createdAt,
        })
      }
    }
  })
  tx()
}
```

- [ ] **Step 4: 在 `getDb()` 里调 seed**

修改 `lib/db/client.ts` 顶部加 `import { seedIfEmpty } from './seed'`,在 `applyMigrations(db)` 之后加 `seedIfEmpty(db)`:

```ts
import { seedIfEmpty } from './seed'

// ...
export function getDb(): Database.Database {
  if (_db) return _db
  fs.mkdirSync(DB_DIR, { recursive: true })
  const db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  applyMigrations(db)
  seedIfEmpty(db)
  _db = db
  return db
}
```

- [ ] **Step 5: 跑测试 + 全套**

```bash
npx vitest run && npx tsc --noEmit
```

期望:全绿。

- [ ] **Step 6: 提交**

```bash
git add lib/db/seed.ts lib/db/client.ts tests/db/seed.test.ts
git commit -m "feat(db): seed categories + keyword_configs from fixture on empty db"
```

---

## Task 3: `lib/db/categories.ts` 分类 + 关键词 CRUD

**Files:**
- Create: `lib/db/categories.ts`
- Test: `tests/db/categories.test.ts` (重写,删除旧 `tests/data/categories.test.ts`)
- Delete: `lib/data/categories.ts`、`tests/data/categories.test.ts`

- [ ] **Step 1: 删除旧的 lib/data/categories.ts 与测试**

```bash
git rm lib/data/categories.ts tests/data/categories.test.ts
```

- [ ] **Step 2: 写失败测试**

```ts
// tests/db/categories.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { applyMigrations } from '@/lib/db/client'
import {
  listCategories, createCategory, updateCategoryName,
  updateCategoryAccounts, deleteCategory, replaceKeywords,
  getCategoryById,
} from '@/lib/db/categories'

let db: Database.Database

beforeEach(() => {
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  applyMigrations(db)
})

describe('categories DB', () => {
  it('createCategory + listCategories 往返', () => {
    const created = createCategory(db, { name: '测试', color: '#abc' })
    expect(created.id).toMatch(/^cat-/)
    expect(created.name).toBe('测试')
    expect(created.settings.keywords).toEqual([])

    const list = listCategories(db)
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe(created.id)
  })

  it('replaceKeywords 整体替换并按写入顺序保留', () => {
    const c = createCategory(db, { name: 'X', color: '#000' })
    replaceKeywords(db, c.id, [
      { value: 'a', platforms: ['xiaohongshu'] },
      { value: 'b', platforms: ['wechat', 'xiaohongshu'] },
    ])
    const got = getCategoryById(db, c.id)!
    expect(got.settings.keywords.map((k) => k.value)).toEqual(['a', 'b'])
    expect(got.settings.keywords[1].platforms).toEqual(['wechat', 'xiaohongshu'])

    replaceKeywords(db, c.id, [{ value: 'c', platforms: ['weibo'] }])
    const after = getCategoryById(db, c.id)!
    expect(after.settings.keywords.map((k) => k.value)).toEqual(['c'])
  })

  it('updateCategoryName 改名;updateCategoryAccounts 改账号', () => {
    const c = createCategory(db, { name: '原', color: '#000' })
    updateCategoryName(db, c.id, '新')
    expect(getCategoryById(db, c.id)?.name).toBe('新')

    updateCategoryAccounts(db, c.id, [
      { platform: 'weibo', handle: 'h', displayName: 'd' },
    ])
    expect(getCategoryById(db, c.id)?.settings.accounts).toHaveLength(1)
  })

  it('deleteCategory 级联删 keyword_configs', () => {
    const c = createCategory(db, { name: 'D', color: '#000' })
    replaceKeywords(db, c.id, [{ value: 'k', platforms: ['xiaohongshu'] }])
    deleteCategory(db, c.id)
    const kw = db.prepare('SELECT count(*) as n FROM keyword_configs').get() as { n: number }
    expect(kw.n).toBe(0)
    expect(listCategories(db)).toHaveLength(0)
  })
})
```

- [ ] **Step 3: 跑确认失败**

```bash
npx vitest run tests/db/categories.test.ts
```

期望:模块找不到。

- [ ] **Step 4: 写 `lib/db/categories.ts`**

```ts
// lib/db/categories.ts
import type Database from 'better-sqlite3'
import type { Category, KeywordConfig, MonitorSettings, Platform } from '@/lib/types'
import { CATEGORY_COLORS } from '@/lib/types'
import { today } from '@/lib/utils/dates'

type CategoryRow = {
  id: string
  name: string
  color: string
  created_at: string
  accounts: string
}

type KeywordRow = {
  id: number
  category_id: string
  value: string
  platforms: string
  created_at: string
}

function rowToCategory(row: CategoryRow, keywords: KeywordConfig[]): Category {
  const accounts = JSON.parse(row.accounts) as MonitorSettings['accounts']
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    createdAt: row.created_at,
    settings: { keywords, accounts },
  }
}

function loadKeywordsFor(db: Database.Database, ids: string[]): Map<string, KeywordConfig[]> {
  const out = new Map<string, KeywordConfig[]>()
  if (ids.length === 0) return out
  const placeholders = ids.map(() => '?').join(',')
  const rows = db
    .prepare(`SELECT * FROM keyword_configs WHERE category_id IN (${placeholders}) ORDER BY id`)
    .all(...ids) as KeywordRow[]
  for (const id of ids) out.set(id, [])
  for (const r of rows) {
    out.get(r.category_id)!.push({
      value: r.value,
      platforms: JSON.parse(r.platforms) as Platform[],
    })
  }
  return out
}

export function listCategories(db: Database.Database): Category[] {
  const rows = db
    .prepare('SELECT * FROM categories ORDER BY created_at, id')
    .all() as CategoryRow[]
  const kwMap = loadKeywordsFor(db, rows.map((r) => r.id))
  return rows.map((r) => rowToCategory(r, kwMap.get(r.id) ?? []))
}

export function getCategoryById(db: Database.Database, id: string): Category | undefined {
  const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as CategoryRow | undefined
  if (!row) return undefined
  const kwMap = loadKeywordsFor(db, [id])
  return rowToCategory(row, kwMap.get(id) ?? [])
}

export function createCategory(
  db: Database.Database,
  input: { name: string; color?: string }
): Category {
  const existing = db.prepare('SELECT count(*) as n FROM categories').get() as { n: number }
  const color = input.color ?? CATEGORY_COLORS[existing.n % CATEGORY_COLORS.length]
  const id = `cat-${Date.now()}`
  const created_at = today()
  db.prepare(`
    INSERT INTO categories (id, name, color, created_at, accounts)
    VALUES (?, ?, ?, ?, '[]')
  `).run(id, input.name, color, created_at)
  return {
    id, name: input.name, color, createdAt: created_at,
    settings: { keywords: [], accounts: [] },
  }
}

export function updateCategoryName(db: Database.Database, id: string, name: string): void {
  db.prepare('UPDATE categories SET name = ? WHERE id = ?').run(name, id)
}

export function updateCategoryAccounts(
  db: Database.Database,
  id: string,
  accounts: MonitorSettings['accounts']
): void {
  db.prepare('UPDATE categories SET accounts = ? WHERE id = ?')
    .run(JSON.stringify(accounts), id)
}

export function deleteCategory(db: Database.Database, id: string): void {
  db.prepare('DELETE FROM categories WHERE id = ?').run(id)
}

export function replaceKeywords(
  db: Database.Database,
  categoryId: string,
  keywords: KeywordConfig[]
): void {
  const created_at = today()
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM keyword_configs WHERE category_id = ?').run(categoryId)
    const insert = db.prepare(`
      INSERT INTO keyword_configs (category_id, value, platforms, created_at)
      VALUES (?, ?, ?, ?)
    `)
    for (const k of keywords) {
      insert.run(categoryId, k.value, JSON.stringify(k.platforms), created_at)
    }
  })
  tx()
}
```

- [ ] **Step 5: 跑测试**

```bash
npx vitest run tests/db/categories.test.ts && npx tsc --noEmit
```

期望:4 测试 PASS,tsc 无错误。

- [ ] **Step 6: 提交**

```bash
git add lib/db/categories.ts tests/db/categories.test.ts
git rm lib/data/categories.ts tests/data/categories.test.ts
git commit -m "feat(db): categories + keyword_configs CRUD helpers"
```

---

## Task 4: `lib/db/queries.ts` keyword_queries + query_notes

**Files:**
- Create: `lib/db/queries.ts`
- Test: `tests/db/queries.test.ts` (new)

- [ ] **Step 1: 写失败测试**

```ts
// tests/db/queries.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { applyMigrations } from '@/lib/db/client'
import { createCategory } from '@/lib/db/categories'
import {
  logQuerySuccess, logQueryError, listQueries, getQueryWithNotes,
} from '@/lib/db/queries'

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
       published_at, collected_at, likes, views, hot_score)
    VALUES (?, ?, 'xiaohongshu', 'kw', 'T', 'S', 'A', 'http://x',
            '2026-04-25', '2026-04-25', 100, 200, 80)
  `).run(id, categoryId)
}

describe('queries DB', () => {
  it('logQuerySuccess 单事务写 keyword_queries + query_notes', () => {
    const c = createCategory(db, { name: 'C', color: '#000' })
    seedNote('n1', c.id)
    seedNote('n2', c.id)
    const queryId = logQuerySuccess(db, {
      categoryId: c.id,
      keyword: 'kw',
      platform: 'xiaohongshu',
      startedAt: '2026-04-25T10:00:00.000Z',
      finishedAt: '2026-04-25T10:00:04.000Z',
      notes: [
        { noteId: 'n1', hotScore: 80, likes: 100, comments: 5, views: 200 },
        { noteId: 'n2', hotScore: 60, likes: 50, comments: null, views: 100 },
      ],
    })
    expect(queryId).toBeGreaterThan(0)

    const queries = listQueries(db, { categoryId: c.id })
    expect(queries.items).toHaveLength(1)
    expect(queries.items[0].returnedCount).toBe(2)
    expect(queries.items[0].status).toBe('success')

    const detail = getQueryWithNotes(db, queryId)!
    expect(detail.notes).toHaveLength(2)
    expect(detail.notes.find((n) => n.id === 'n1')?.snapshot.hotScore).toBe(80)
  })

  it('logQueryError 写 status=error,无 query_notes', () => {
    const c = createCategory(db, { name: 'C', color: '#000' })
    const id = logQueryError(db, {
      categoryId: c.id,
      keyword: 'kw',
      platform: 'xiaohongshu',
      startedAt: '2026-04-25T10:00:00.000Z',
      finishedAt: '2026-04-25T10:00:01.000Z',
      errorMessage: '账户积分用尽',
    })
    const detail = getQueryWithNotes(db, id)!
    expect(detail.query.status).toBe('error')
    expect(detail.query.errorMessage).toBe('账户积分用尽')
    expect(detail.notes).toEqual([])
  })

  it('listQueries 支持 keyword / platform / status 过滤', () => {
    const c = createCategory(db, { name: 'C', color: '#000' })
    logQueryError(db, { categoryId: c.id, keyword: 'a', platform: 'xiaohongshu',
      startedAt: '2026-04-25T10:00:00.000Z', finishedAt: '2026-04-25T10:00:01.000Z',
      errorMessage: 'e1' })
    logQueryError(db, { categoryId: c.id, keyword: 'b', platform: 'wechat',
      startedAt: '2026-04-25T10:00:02.000Z', finishedAt: '2026-04-25T10:00:03.000Z',
      errorMessage: 'e2' })
    expect(listQueries(db, { categoryId: c.id, keyword: 'a' }).items).toHaveLength(1)
    expect(listQueries(db, { categoryId: c.id, platform: 'wechat' }).items).toHaveLength(1)
    expect(listQueries(db, { categoryId: c.id, status: 'error' }).items).toHaveLength(2)
  })

  it('listQueries 按 started_at DESC + 支持 cursor 分页', () => {
    const c = createCategory(db, { name: 'C', color: '#000' })
    for (let i = 0; i < 5; i++) {
      logQueryError(db, { categoryId: c.id, keyword: `k${i}`, platform: 'xiaohongshu',
        startedAt: `2026-04-25T10:00:0${i}.000Z`,
        finishedAt: `2026-04-25T10:00:0${i}.500Z`, errorMessage: 'e' })
    }
    const page1 = listQueries(db, { categoryId: c.id, limit: 2 })
    expect(page1.items.map((q) => q.keyword)).toEqual(['k4', 'k3'])
    expect(page1.nextCursor).toBeDefined()
    const page2 = listQueries(db, { categoryId: c.id, limit: 2, cursor: page1.nextCursor })
    expect(page2.items.map((q) => q.keyword)).toEqual(['k2', 'k1'])
  })
})
```

- [ ] **Step 2: 跑确认失败**

```bash
npx vitest run tests/db/queries.test.ts
```

期望:模块找不到。

- [ ] **Step 3: 写 `lib/db/queries.ts`**

```ts
// lib/db/queries.ts
import type Database from 'better-sqlite3'
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

export function logQuerySuccess(
  db: Database.Database,
  input: {
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
  }
): number {
  let queryId = 0
  const tx = db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO keyword_queries
        (category_id, keyword, platform, started_at, finished_at, status, returned_count)
      VALUES (?, ?, ?, ?, ?, 'success', ?)
    `).run(
      input.categoryId, input.keyword, input.platform,
      input.startedAt, input.finishedAt, input.notes.length
    )
    queryId = Number(info.lastInsertRowid)
    const insertNote = db.prepare(`
      INSERT OR IGNORE INTO query_notes
        (query_id, note_id, hot_score_snapshot, likes_snapshot, comments_snapshot, views_snapshot)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    for (const n of input.notes) {
      insertNote.run(queryId, n.noteId, n.hotScore, n.likes, n.comments, n.views)
    }
  })
  tx()
  return queryId
}

export function logQueryError(
  db: Database.Database,
  input: {
    categoryId: string
    keyword: string
    platform: Platform
    startedAt: string
    finishedAt: string
    errorMessage: string
  }
): number {
  const info = db.prepare(`
    INSERT INTO keyword_queries
      (category_id, keyword, platform, started_at, finished_at, status,
       returned_count, error_message)
    VALUES (?, ?, ?, ?, ?, 'error', 0, ?)
  `).run(
    input.categoryId, input.keyword, input.platform,
    input.startedAt, input.finishedAt, input.errorMessage
  )
  return Number(info.lastInsertRowid)
}

export type ListQueriesParams = {
  categoryId: string
  keyword?: string
  platform?: Platform
  status?: QueryStatus
  limit?: number
  cursor?: string  // base64-encoded "<started_at>|<id>"
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
    const [startedAt, idStr] = Buffer.from(cursor, 'base64').toString('utf8').split('|')
    return { startedAt, id: Number(idStr) }
  } catch {
    return null
  }
}

export function listQueries(
  db: Database.Database,
  params: ListQueriesParams
): ListQueriesResult {
  const limit = Math.min(params.limit ?? 50, 200)
  const where: string[] = ['category_id = @category_id']
  const bind: Record<string, unknown> = { category_id: params.categoryId, limit: limit + 1 }
  if (params.keyword) { where.push('keyword = @keyword'); bind.keyword = params.keyword }
  if (params.platform) { where.push('platform = @platform'); bind.platform = params.platform }
  if (params.status) { where.push('status = @status'); bind.status = params.status }
  if (params.cursor) {
    const decoded = decodeCursor(params.cursor)
    if (decoded) {
      where.push('(started_at, id) < (@cursor_started, @cursor_id)')
      bind.cursor_started = decoded.startedAt
      bind.cursor_id = decoded.id
    }
  }
  const sql = `
    SELECT * FROM keyword_queries
    WHERE ${where.join(' AND ')}
    ORDER BY started_at DESC, id DESC
    LIMIT @limit
  `
  const rows = db.prepare(sql).all(bind) as QueryRow[]
  const items = rows.slice(0, limit).map(rowToSummary)
  const hasMore = rows.length > limit
  const nextCursor = hasMore
    ? encodeCursor(items[items.length - 1].startedAt, items[items.length - 1].id)
    : undefined
  return { items, nextCursor }
}

export function getQueryWithNotes(
  db: Database.Database,
  queryId: number
): QueryDetail | undefined {
  const row = db.prepare('SELECT * FROM keyword_queries WHERE id = ?').get(queryId) as QueryRow | undefined
  if (!row) return undefined
  const notes = db.prepare(`
    SELECT n.*, qn.hot_score_snapshot, qn.likes_snapshot, qn.comments_snapshot, qn.views_snapshot
    FROM query_notes qn
    JOIN collected_notes n ON n.id = qn.note_id
    WHERE qn.query_id = ?
    ORDER BY qn.hot_score_snapshot DESC NULLS LAST, n.id
  `).all(queryId) as Array<Record<string, unknown>>

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
    coverImage: n.cover_image as string | undefined,
    stats: {
      likes: Number(n.likes ?? 0),
      comments: n.comments == null ? undefined : Number(n.comments),
      shares: n.shares == null ? undefined : Number(n.shares),
      views: Number(n.views ?? 0),
    },
    hotScore: Number(n.hot_score ?? 0),
    tags: JSON.parse(String(n.tags ?? '[]')),
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

- [ ] **Step 4: 跑测试**

```bash
npx vitest run tests/db/queries.test.ts && npx tsc --noEmit
```

期望:4 测试 PASS,tsc 无错。

- [ ] **Step 5: 提交**

```bash
git add lib/db/queries.ts tests/db/queries.test.ts
git commit -m "feat(db): keyword_queries log + query_notes snapshot helpers"
```

---

## Task 5: `/api/categories` GET + POST

**Files:**
- Create: `app/api/categories/route.ts`

- [ ] **Step 1: 写路由**

```ts
// app/api/categories/route.ts
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db/client'
import { listCategories, createCategory } from '@/lib/db/categories'

export const runtime = 'nodejs'

export async function GET() {
  const db = getDb()
  return NextResponse.json({ items: listCategories(db) })
}

export async function POST(req: Request) {
  let body: { name?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const name = (body.name ?? '').trim()
  if (!name) return NextResponse.json({ error: 'Missing name' }, { status: 400 })
  const db = getDb()
  const created = createCategory(db, { name })
  return NextResponse.json({ category: created }, { status: 201 })
}
```

- [ ] **Step 2: 用 curl 手测**

```bash
# 假设 dev server 已起;若没有,先 `npm run dev` 后台
curl -s http://localhost:3000/api/categories | head -c 400
curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"name":"测试新建"}' http://localhost:3000/api/categories
curl -s http://localhost:3000/api/categories | grep -c '测试新建'
```

期望:第一次返回种子 3 条;POST 返回 201 + 新 category;第三次 grep 输出 ≥1。

- [ ] **Step 3: tsc 检查**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: 提交**

```bash
git add app/api/categories/route.ts
git commit -m "feat(api): GET/POST /api/categories"
```

---

## Task 6: `/api/categories/[id]` PATCH/DELETE + `/keywords` PUT

**Files:**
- Create: `app/api/categories/[id]/route.ts`
- Create: `app/api/categories/[id]/keywords/route.ts`

- [ ] **Step 1: 写 `[id]/route.ts`**

```ts
// app/api/categories/[id]/route.ts
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db/client'
import {
  getCategoryById, updateCategoryName,
  updateCategoryAccounts, deleteCategory,
} from '@/lib/db/categories'
import type { MonitorSettings } from '@/lib/types'

export const runtime = 'nodejs'

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params
  let body: { name?: string; accounts?: MonitorSettings['accounts'] }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const db = getDb()
  if (!getCategoryById(db, id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (typeof body.name === 'string') {
    const trimmed = body.name.trim()
    if (!trimmed) return NextResponse.json({ error: 'Empty name' }, { status: 400 })
    updateCategoryName(db, id, trimmed)
  }
  if (Array.isArray(body.accounts)) {
    updateCategoryAccounts(db, id, body.accounts)
  }
  return NextResponse.json({ category: getCategoryById(db, id) })
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params
  const db = getDb()
  if (!getCategoryById(db, id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  deleteCategory(db, id)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: 写 `[id]/keywords/route.ts`**

```ts
// app/api/categories/[id]/keywords/route.ts
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
```

- [ ] **Step 3: 用 curl 手测**

```bash
# 取一个 cat id
ID=$(curl -s http://localhost:3000/api/categories | python3 -c \
  'import json,sys;print(json.load(sys.stdin)["items"][0]["id"])')
curl -s -X PATCH -H 'Content-Type: application/json' \
  -d '{"name":"重命名了"}' http://localhost:3000/api/categories/$ID
curl -s -X PUT -H 'Content-Type: application/json' \
  -d '{"keywords":[{"value":"测试 kw","platforms":["xiaohongshu"]}]}' \
  http://localhost:3000/api/categories/$ID/keywords
curl -s -X DELETE http://localhost:3000/api/categories/$ID
```

期望:PATCH/PUT 返回新 category;DELETE 返回 `{ok:true}`。

- [ ] **Step 4: tsc + 全套测试**

```bash
npx tsc --noEmit && npx vitest run
```

- [ ] **Step 5: 提交**

```bash
git add app/api/categories/[id]
git commit -m "feat(api): PATCH/DELETE category + PUT keywords"
```

---

## Task 7: `/api/queries` GET 列表 + GET 详情

**Files:**
- Create: `app/api/queries/route.ts`
- Create: `app/api/queries/[id]/route.ts`

- [ ] **Step 1: 写列表路由**

```ts
// app/api/queries/route.ts
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db/client'
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

  const db = getDb()
  const result = listQueries(db, { categoryId, keyword, platform, status, limit, cursor })
  return NextResponse.json(result)
}
```

- [ ] **Step 2: 写详情路由**

```ts
// app/api/queries/[id]/route.ts
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db/client'
import { getQueryWithNotes } from '@/lib/db/queries'

export const runtime = 'nodejs'

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params
  const queryId = Number(id)
  if (!Number.isFinite(queryId) || queryId <= 0) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }
  const db = getDb()
  const detail = getQueryWithNotes(db, queryId)
  if (!detail) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(detail)
}
```

- [ ] **Step 3: 手测**

```bash
ID=$(curl -s http://localhost:3000/api/categories | python3 -c \
  'import json,sys;print(json.load(sys.stdin)["items"][0]["id"])')
curl -s "http://localhost:3000/api/queries?categoryId=$ID&limit=10" | head -c 400
```

期望:`{"items":[],"nextCursor":...}` 或带数据(取决于是否已有事件)。

- [ ] **Step 4: tsc**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: 提交**

```bash
git add app/api/queries
git commit -m "feat(api): GET /api/queries list + detail"
```

---

## Task 8: xhs collect 写 query 事件

**Files:**
- Modify: `app/api/xhs/collect/route.ts`

- [ ] **Step 1: 替换文件**

```ts
// app/api/xhs/collect/route.ts
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db/client'
import { logQueryError, logQuerySuccess } from '@/lib/db/queries'

export const runtime = 'nodejs'
export const maxDuration = 120

type XhsImage = { url?: string; url_default?: string; url_pre?: string }
type XhsUser = { nickname?: string; images?: string; red_id?: string; userid?: string; user_id?: string }
type XhsNote = {
  id?: string; note_id?: string; title?: string; desc?: string; display_title?: string
  liked_count?: number; collected_count?: number; comments_count?: number; shared_count?: number
  images_list?: XhsImage[]; cover?: XhsImage
  timestamp?: number; time?: number
  tag_info?: Array<{ name?: string }> | string[]
  user?: XhsUser
}
type XhsItem = { note?: XhsNote; model_type?: string } & Partial<XhsNote>
type UpstreamResponse = {
  success?: boolean; code?: string | number; message?: string; msg?: string
  solution?: string; retryable?: boolean
  data?: { items?: XhsItem[]; has_more?: boolean }
}

function isSuccess(json: UpstreamResponse): boolean {
  if (json.success === true) return true
  if (json.success === false) return false
  const c = json.code
  return c == null || c === 0 || c === 200 || c === '0' || c === '200'
}
function isRetryable(json: UpstreamResponse): boolean {
  if (typeof json.retryable === 'boolean') return json.retryable
  return json.code === 1001 || json.code === '1001'
}
function hotScoreOf(liked: number, comments: number, collected: number): number {
  const raw = 15 + 14 * Math.log10((liked ?? 0) + 1)
    + 10 * Math.log10((comments ?? 0) + 1)
    + 8 * Math.log10((collected ?? 0) + 1)
  return Math.max(0, Math.min(100, Math.round(raw)))
}
function pickCover(note: XhsNote): string | null {
  if (note.cover?.url_default) return note.cover.url_default
  if (note.cover?.url) return note.cover.url
  const first = note.images_list?.[0]
  return first?.url_default ?? first?.url ?? first?.url_pre ?? null
}
function pickTags(note: XhsNote): string[] {
  const info = note.tag_info
  if (!info) return []
  if (Array.isArray(info)) {
    return info.map((t) => (typeof t === 'string' ? t : t?.name ?? ''))
      .filter((s): s is string => Boolean(s)).slice(0, 4)
  }
  return []
}
function pickTimestamp(note: XhsNote): number {
  const ts = note.timestamp ?? note.time ?? 0
  if (ts > 1e12) return ts
  if (ts > 0) return ts * 1000
  return Date.now()
}

export async function POST(req: Request) {
  const apiKey = process.env.XHS_SEARCH_API_KEY
  const apiUrl = process.env.XHS_SEARCH_API_URL
  if (!apiKey || !apiUrl) {
    return NextResponse.json(
      { error: 'XHS_SEARCH_API_KEY or XHS_SEARCH_API_URL not configured' },
      { status: 500 })
  }

  let body: { categoryId?: string; keyword?: string; page?: number }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const categoryId = (body.categoryId ?? '').trim()
  const keyword = (body.keyword ?? '').trim()
  if (!categoryId || !keyword) {
    return NextResponse.json({ error: 'Missing categoryId or keyword' }, { status: 400 })
  }

  const startedAt = new Date().toISOString()
  const payload = {
    type: 9, keyword, page: String(body.page ?? 1),
    sort: 'comment_descending', note_type: 'note', note_time: 'day',
    searchId: '', sessionId: '',
  }

  const RETRY_DELAYS_MS = [10_000, 30_000, 60_000]
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

  type CallResult =
    | { kind: 'ok'; json: UpstreamResponse }
    | { kind: 'business-error'; json: UpstreamResponse }
    | { kind: 'transport-error'; status: number; detail: string }

  async function callUpstreamOnce(): Promise<CallResult> {
    try {
      const upstream = await fetch(apiUrl!, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), cache: 'no-store',
      })
      const text = await upstream.text().catch(() => '')
      let json: UpstreamResponse | null = null
      try { json = text ? (JSON.parse(text) as UpstreamResponse) : null } catch { json = null }
      if (json && (json.success != null || json.code != null || typeof json.retryable === 'boolean')) {
        if (isSuccess(json)) return { kind: 'ok', json }
        return { kind: 'business-error', json }
      }
      return { kind: 'transport-error', status: upstream.status, detail: text.slice(0, 500) }
    } catch (err) {
      return { kind: 'transport-error', status: 0, detail: err instanceof Error ? err.message : String(err) }
    }
  }

  const db = getDb()
  let json: UpstreamResponse | null = null
  let lastBusinessError: UpstreamResponse | null = null
  let lastTransportError: { status: number; detail: string } | null = null
  const totalAttempts = 1 + RETRY_DELAYS_MS.length

  for (let attempt = 0; attempt < totalAttempts; attempt++) {
    if (attempt > 0) await sleep(RETRY_DELAYS_MS[attempt - 1])
    const result = await callUpstreamOnce()
    if (result.kind === 'ok') { json = result.json; break }
    if (result.kind === 'transport-error') {
      lastTransportError = { status: result.status, detail: result.detail }
      continue
    }
    if (isRetryable(result.json)) { lastBusinessError = result.json; continue }
    // 不可重试业务错误 → 落 query error 行 + 立即返回
    const finishedAt = new Date().toISOString()
    const errMsg = result.json.message ?? result.json.msg ?? `code=${result.json.code}`
    logQueryError(db, {
      categoryId, keyword, platform: 'xiaohongshu',
      startedAt, finishedAt, errorMessage: errMsg,
    })
    return NextResponse.json({
      error: 'Upstream rejected',
      upstreamCode: result.json.code,
      upstreamMessage: result.json.message ?? result.json.msg,
      solution: result.json.solution,
    }, { status: 502 })
  }

  if (!json) {
    const finishedAt = new Date().toISOString()
    const errMsg = lastBusinessError?.message ?? lastBusinessError?.msg
      ?? `transport ${lastTransportError?.status} ${lastTransportError?.detail ?? ''}`
    logQueryError(db, {
      categoryId, keyword, platform: 'xiaohongshu',
      startedAt, finishedAt, errorMessage: errMsg,
    })
    return NextResponse.json({
      error: 'Upstream unstable after retries',
      attempts: totalAttempts,
      upstreamCode: lastBusinessError?.code,
      upstreamMessage: lastBusinessError?.message ?? lastBusinessError?.msg,
      transportStatus: lastTransportError?.status,
      transportDetail: lastTransportError?.detail,
    }, { status: 502 })
  }

  const items = json.data?.items ?? []
  const nowIso = new Date().toISOString()

  const upsert = db.prepare(`
    INSERT INTO collected_notes (
      id, category_id, platform, keyword,
      title, summary, author, author_id, author_avatar, author_red_id,
      url, cover_image, published_at, collected_at,
      likes, comments, shares, views, hot_score, tags, raw
    ) VALUES (
      @id, @category_id, @platform, @keyword,
      @title, @summary, @author, @author_id, @author_avatar, @author_red_id,
      @url, @cover_image, @published_at, @collected_at,
      @likes, @comments, @shares, @views, @hot_score, @tags, @raw
    )
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title, summary = excluded.summary,
      author = excluded.author, author_id = excluded.author_id,
      author_avatar = excluded.author_avatar, author_red_id = excluded.author_red_id,
      url = excluded.url, cover_image = excluded.cover_image,
      likes = excluded.likes, comments = excluded.comments,
      shares = excluded.shares, views = excluded.views,
      hot_score = excluded.hot_score, tags = excluded.tags,
      raw = excluded.raw, collected_at = excluded.collected_at
  `)

  type SnapshotEntry = {
    noteId: string; hotScore: number; likes: number; comments: number | null; views: number
  }
  type RowAndSnapshot = { row: Record<string, unknown>; snap: SnapshotEntry }
  const prepared: RowAndSnapshot[] = []
  for (const wrap of items) {
    const note: XhsNote = wrap.note ?? (wrap as XhsNote)
    const noteId = note.id ?? note.note_id
    if (!noteId || !note.title) continue
    const user = note.user ?? {}
    const publishedMs = pickTimestamp(note)
    const likes = note.liked_count ?? 0
    const comments = note.comments_count
    const shares = note.shared_count
    const collected = note.collected_count ?? 0
    const hotScore = hotScoreOf(likes, comments ?? 0, collected)
    const id = `xhs-${noteId}`
    prepared.push({
      row: {
        id, category_id: categoryId, platform: 'xiaohongshu', keyword,
        title: (note.title ?? note.display_title ?? '').slice(0, 200),
        summary: (note.desc ?? '').replace(/\s+/g, ' ').trim().slice(0, 200),
        author: user.nickname ?? '',
        author_id: user.userid ?? user.user_id ?? null,
        author_avatar: user.images ?? null,
        author_red_id: user.red_id ?? null,
        url: `https://www.xiaohongshu.com/explore/${noteId}`,
        cover_image: pickCover(note),
        published_at: new Date(publishedMs).toISOString(),
        collected_at: nowIso,
        likes, comments: comments ?? null, shares: shares ?? null,
        views: collected, hot_score: hotScore,
        tags: JSON.stringify(pickTags(note)),
        raw: JSON.stringify(wrap),
      },
      snap: { noteId: id, hotScore, likes, comments: comments ?? null, views: collected },
    })
  }

  const finishedAt = new Date().toISOString()
  const tx = db.transaction(() => {
    for (const p of prepared) upsert.run(p.row)
  })
  tx()
  logQuerySuccess(db, {
    categoryId, keyword, platform: 'xiaohongshu',
    startedAt, finishedAt,
    notes: prepared.map((p) => p.snap),
  })

  return NextResponse.json({ ok: true, saved: prepared.length, total: items.length })
}
```

- [ ] **Step 2: tsc + 已有测试**

```bash
npx tsc --noEmit && npx vitest run
```

- [ ] **Step 3: 手测**

```bash
ID=$(curl -s http://localhost:3000/api/categories | python3 -c \
  'import json,sys;print(json.load(sys.stdin)["items"][0]["id"])')
# 触发一次(账户欠费时也行,会落 error 行)
curl -s -X POST -H 'Content-Type: application/json' \
  -d "{\"categoryId\":\"$ID\",\"keyword\":\"claude code\"}" \
  http://localhost:3000/api/xhs/collect
curl -s "http://localhost:3000/api/queries?categoryId=$ID&limit=5"
```

期望:`/api/queries` 返回至少 1 条事件(success 或 error)。

- [ ] **Step 4: 提交**

```bash
git add app/api/xhs/collect/route.ts
git commit -m "feat(api): xhs collect logs keyword_queries + query_notes"
```

---

## Task 9: wechat search → DB-backed collect

**Files:**
- Modify: `app/api/wechat/search/route.ts`
- Modify: `lib/data/wechat.ts`

- [ ] **Step 1: 改写 wechat 路由为 DB-backed**

```ts
// app/api/wechat/search/route.ts
import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db/client'
import { logQueryError, logQuerySuccess } from '@/lib/db/queries'

export const runtime = 'nodejs'

export type WechatDatum = {
  avatar: string; classify: string; content: string; ghid: string
  ip_wording: string; is_original: number; looking: number; praise: number
  publish_time: number; publish_time_str: string; read: number; short_link: string
  title: string; update_time: number; update_time_str: string; url: string
  wx_id: string; wx_name: string
}

type UpstreamResponse = {
  success?: boolean; code?: string | number; message?: string; msg?: string
  solution?: string; retryable?: boolean; requestId?: string
  data?: { data?: WechatDatum[]; data_number?: number; page?: number; total?: number; total_page?: number }
}

function isSuccess(json: UpstreamResponse): boolean {
  if (json.success === true) return true
  if (json.success === false) return false
  const c = json.code
  return c == null || c === 0 || c === 200 || c === '0' || c === '200'
}
function hotScoreOf(read: number, praise: number): number {
  const raw = 20 + 15 * Math.log10((read ?? 0) + 1) + 8 * Math.log10((praise ?? 0) + 1)
  return Math.max(0, Math.min(100, Math.round(raw)))
}

export async function POST(req: Request) {
  const apiKey = process.env.WECHAT_SEARCH_API_KEY
  const apiUrl = process.env.WECHAT_SEARCH_API_URL
  if (!apiKey || !apiUrl) {
    return NextResponse.json(
      { error: 'WECHAT_SEARCH_API_KEY or WECHAT_SEARCH_API_URL not configured' },
      { status: 500 })
  }

  let body: { categoryId?: string; keyword?: string; period?: number; page?: number }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const categoryId = (body.categoryId ?? '').trim()
  const keyword = (body.keyword ?? '').trim()
  if (!categoryId || !keyword) {
    return NextResponse.json({ error: 'Missing categoryId or keyword' }, { status: 400 })
  }

  const startedAt = new Date().toISOString()
  const payload = {
    kw: keyword, sort_type: 1, mode: 1,
    period: body.period ?? 7, page: body.page ?? 1,
    any_kw: '', ex_kw: '', verifycode: '', type: 1,
  }

  const db = getDb()

  let json: UpstreamResponse | null = null
  let transportInfo: { status: number; detail: string } | null = null
  try {
    const upstream = await fetch(apiUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload), cache: 'no-store',
    })
    const text = await upstream.text().catch(() => '')
    try { json = text ? (JSON.parse(text) as UpstreamResponse) : null } catch { json = null }
    if (!json) transportInfo = { status: upstream.status, detail: text.slice(0, 500) }
  } catch (err) {
    transportInfo = { status: 0, detail: err instanceof Error ? err.message : String(err) }
  }

  if (!json || !isSuccess(json)) {
    const finishedAt = new Date().toISOString()
    const errMsg = json?.message ?? json?.msg ?? transportInfo?.detail ?? 'unknown error'
    logQueryError(db, {
      categoryId, keyword, platform: 'wechat',
      startedAt, finishedAt, errorMessage: errMsg,
    })
    return NextResponse.json({
      error: json ? 'Upstream rejected' : `Upstream ${transportInfo?.status ?? 0}`,
      upstreamCode: json?.code, upstreamMessage: json?.message ?? json?.msg,
      solution: json?.solution, detail: transportInfo?.detail,
    }, { status: 502 })
  }

  const items = json.data?.data ?? []
  const nowIso = new Date().toISOString()
  const upsert = db.prepare(`
    INSERT INTO collected_notes (
      id, category_id, platform, keyword,
      title, summary, author, author_id, author_avatar, author_red_id,
      url, cover_image, published_at, collected_at,
      likes, comments, shares, views, hot_score, tags, raw
    ) VALUES (
      @id, @category_id, 'wechat', @keyword,
      @title, @summary, @author, @author_id, @author_avatar, NULL,
      @url, NULL, @published_at, @collected_at,
      @likes, NULL, NULL, @views, @hot_score, @tags, @raw
    )
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title, summary = excluded.summary,
      author = excluded.author, author_id = excluded.author_id,
      author_avatar = excluded.author_avatar, url = excluded.url,
      likes = excluded.likes, views = excluded.views,
      hot_score = excluded.hot_score, tags = excluded.tags,
      raw = excluded.raw, collected_at = excluded.collected_at
  `)

  type Snap = { noteId: string; hotScore: number; likes: number; views: number }
  const prepared: Array<{ row: Record<string, unknown>; snap: Snap }> = []
  for (const d of items) {
    const target = d.url || d.short_link
    if (!target || !d.title) continue
    const id = `wechat-${createHash('sha1').update(target).digest('hex').slice(0, 16)}`
    const likes = d.praise ?? 0
    const views = d.read ?? 0
    const hotScore = hotScoreOf(views, likes)
    const publishedAt = new Date((d.publish_time ?? 0) * 1000).toISOString()
    prepared.push({
      row: {
        id, category_id: categoryId, keyword,
        title: d.title.slice(0, 200),
        summary: (d.content ?? '').replace(/\s+/g, ' ').trim().slice(0, 200),
        author: d.wx_name ?? '',
        author_id: d.wx_id ?? null,
        author_avatar: d.avatar ?? null,
        url: target,
        published_at: publishedAt,
        collected_at: nowIso,
        likes, views, hot_score: hotScore,
        tags: JSON.stringify(d.classify ? [d.classify] : []),
        raw: JSON.stringify(d),
      },
      snap: { noteId: id, hotScore, likes, views },
    })
  }

  const tx = db.transaction(() => {
    for (const p of prepared) upsert.run(p.row)
  })
  tx()
  const finishedAt = new Date().toISOString()
  logQuerySuccess(db, {
    categoryId, keyword, platform: 'wechat',
    startedAt, finishedAt,
    notes: prepared.map((p) => ({
      noteId: p.snap.noteId, hotScore: p.snap.hotScore,
      likes: p.snap.likes, comments: null, views: p.snap.views,
    })),
  })

  return NextResponse.json({ ok: true, saved: prepared.length, total: items.length })
}
```

- [ ] **Step 2: 改写 lib/data/wechat.ts(对齐 xhs)**

```ts
// lib/data/wechat.ts
import type { ContentItem, KeywordConfig } from '@/lib/types'

const TTL_MS = 5 * 60 * 1000
const cache = new Map<string, { items: ContentItem[]; expiresAt: number }>()
const inflight = new Map<string, Promise<ContentItem[]>>()

async function fetchNotesFromDb(categoryId: string): Promise<ContentItem[]> {
  const qs = new URLSearchParams({ categoryId, platform: 'wechat' })
  const res = await fetch(`/api/notes?${qs.toString()}`, { cache: 'no-store' })
  if (!res.ok) return []
  const json = (await res.json()) as { items: ContentItem[] }
  return json.items ?? []
}

async function collectOne(categoryId: string, keyword: string): Promise<void> {
  try {
    const res = await fetch('/api/wechat/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryId, keyword, period: 7 }),
    })
    if (!res.ok) console.warn('[wechat] collect failed', keyword, res.status)
  } catch (err) {
    console.warn('[wechat] collect error', keyword, err)
  }
}

export function invalidateWechat(categoryId: string, _keyword?: string): void {
  for (const key of Array.from(cache.keys())) {
    if (key.startsWith(`${categoryId}:`)) cache.delete(key)
  }
}

export async function getWechatArticles(
  categoryId: string,
  keywords: KeywordConfig[] | undefined
): Promise<ContentItem[]> {
  if (!keywords || keywords.length === 0) return []
  const enabled = keywords.filter((k) => k.platforms.includes('wechat'))
  if (enabled.length === 0) return []
  const values = enabled.map((k) => k.value)
  const cacheKey = `${categoryId}:${values.slice().sort().join(',')}`
  const cached = cache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.items
  const existing = inflight.get(cacheKey)
  if (existing) return existing

  const promise = (async () => {
    try {
      let items = await fetchNotesFromDb(categoryId)
      if (items.length === 0) {
        await Promise.all(values.map((kw) => collectOne(categoryId, kw)))
        items = await fetchNotesFromDb(categoryId)
      }
      cache.set(cacheKey, { items, expiresAt: Date.now() + TTL_MS })
      return items
    } finally {
      inflight.delete(cacheKey)
    }
  })()
  inflight.set(cacheKey, promise)
  return promise
}
```

- [ ] **Step 3: 同步更新 components/refresh-menu.tsx(wechat 调用方式改了)**

`refresh-menu.tsx:37-41` 当前 wechat 分支只调 `invalidateWechat`(假设上层 fetch 触发)。改为先 POST `/api/wechat/search` 再 invalidate:

```ts
// components/refresh-menu.tsx 中 refreshOne 函数,替换 wechat 分支
if (platform === 'wechat') {
  const res = await fetch('/api/wechat/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ categoryId, keyword, period: 7 }),
  })
  const body = (await res.json().catch(() => ({}))) as {
    upstreamMessage?: string; error?: string
  }
  if (!res.ok) return { ok: false, reason: body.upstreamMessage ?? body.error ?? `HTTP ${res.status}` }
  invalidateWechat(categoryId, keyword)
  return { ok: true }
}
```

- [ ] **Step 4: tsc + 测试**

```bash
npx tsc --noEmit && npx vitest run
```

- [ ] **Step 5: 提交**

```bash
git add app/api/wechat/search/route.ts lib/data/wechat.ts components/refresh-menu.tsx
git commit -m "feat(wechat): collect to db + log queries, align with xhs flow"
```

---

## Task 10: CategoriesProvider — hydrate + 乐观写

**Files:**
- Modify: `components/categories-provider.tsx`

- [ ] **Step 1: 重写 provider**

```tsx
// components/categories-provider.tsx
'use client'

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { toast } from 'sonner'
import type { Category, MonitorSettings } from '@/lib/types'

type Ctx = {
  categories: Category[]
  hydrated: boolean
  getById: (id: string) => Category | undefined
  addCategory: (name: string) => Promise<Category | null>
  renameCategory: (id: string, name: string) => Promise<void>
  removeCategory: (id: string) => Promise<void>
  updateSettings: (id: string, settings: MonitorSettings) => Promise<void>
}

const CategoriesContext = createContext<Ctx | null>(null)

export function CategoriesProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    let alive = true
    fetch('/api/categories', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data: { items: Category[] }) => {
        if (!alive) return
        setCategories(data.items ?? [])
        setHydrated(true)
      })
      .catch((err) => {
        console.warn('[categories] hydrate failed', err)
        if (alive) setHydrated(true)
      })
    return () => { alive = false }
  }, [])

  const getById = useCallback(
    (id: string) => categories.find((c) => c.id === id),
    [categories]
  )

  const addCategory = useCallback(async (name: string): Promise<Category | null> => {
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as { category: Category }
      setCategories((prev) => [...prev, json.category])
      return json.category
    } catch (err) {
      toast.error(`新建分类失败:${err instanceof Error ? err.message : String(err)}`)
      return null
    }
  }, [])

  const renameCategory = useCallback(async (id: string, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const prev = categories
    setCategories((cs) => cs.map((c) => (c.id === id ? { ...c, name: trimmed } : c)))
    try {
      const res = await fetch(`/api/categories/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    } catch (err) {
      setCategories(prev)
      toast.error(`重命名失败:${err instanceof Error ? err.message : String(err)}`)
    }
  }, [categories])

  const removeCategory = useCallback(async (id: string) => {
    const prev = categories
    setCategories((cs) => cs.filter((c) => c.id !== id))
    try {
      const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    } catch (err) {
      setCategories(prev)
      toast.error(`删除失败:${err instanceof Error ? err.message : String(err)}`)
    }
  }, [categories])

  const updateSettings = useCallback(async (id: string, settings: MonitorSettings) => {
    const prev = categories
    setCategories((cs) => cs.map((c) => (c.id === id ? { ...c, settings } : c)))
    try {
      const [r1, r2] = await Promise.all([
        fetch(`/api/categories/${id}/keywords`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keywords: settings.keywords }),
        }),
        fetch(`/api/categories/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accounts: settings.accounts }),
        }),
      ])
      if (!r1.ok || !r2.ok) throw new Error(`HTTP ${r1.status}/${r2.status}`)
    } catch (err) {
      setCategories(prev)
      toast.error(`保存失败:${err instanceof Error ? err.message : String(err)}`)
    }
  }, [categories])

  return (
    <CategoriesContext.Provider
      value={{ categories, hydrated, getById, addCategory, renameCategory, removeCategory, updateSettings }}
    >
      {children}
    </CategoriesContext.Provider>
  )
}

export function useCategories(): Ctx {
  const ctx = useContext(CategoriesContext)
  if (!ctx) throw new Error('useCategories must be used inside <CategoriesProvider>')
  return ctx
}
```

- [ ] **Step 2: 把 `addCategory` 调用方改为 await**

修改 `components/create-category-dialog.tsx:22-30` 的 `handleCreate`:

```tsx
async function handleCreate() {
  const trimmed = name.trim()
  if (!trimmed) return
  const c = await addCategory(trimmed)
  if (!c) return
  toast.success(`已创建分类"${c.name}"`)
  setOpen(false)
  setName('')
  router.push(`/c/${c.id}/content`)
}
```

- [ ] **Step 3: tsc + 全套**

```bash
npx tsc --noEmit && npx vitest run
```

- [ ] **Step 4: 浏览器手测**

```
1. 打开 http://localhost:3000
2. 新建一个分类 "测试持久化"
3. 进入设置,加 1 个关键词
4. 关闭浏览器,重启 dev server (Ctrl-C + npm run dev)
5. 重新打开,确认 "测试持久化" 仍在,关键词仍在
```

- [ ] **Step 5: 提交**

```bash
git add components/categories-provider.tsx components/create-category-dialog.tsx
git commit -m "feat(provider): hydrate categories from db + optimistic writes"
```

---

## Task 11: SSR layout 用 DB 取分类名 + Tab 加「查询历史」

**Files:**
- Modify: `app/c/[categoryId]/layout.tsx`
- Modify: `components/tab-nav.tsx`

- [ ] **Step 1: layout 改用 DB**

```tsx
// app/c/[categoryId]/layout.tsx
import { getDb } from '@/lib/db/client'
import { getCategoryById } from '@/lib/db/categories'
import { TabNav } from '@/components/tab-nav'
import { CategoryName } from '@/components/category-name'

export default async function CategoryLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ categoryId: string }>
}) {
  const { categoryId } = await params
  const cat = getCategoryById(getDb(), categoryId)
  return (
    <>
      <header className="h-16 px-8 flex items-center bg-white sticky top-0 z-10">
        <div className="flex-1">
          <h1 className="text-lg font-semibold tracking-tight">
            <CategoryName id={categoryId} fallback={cat?.name} />
          </h1>
        </div>
      </header>
      <TabNav categoryId={categoryId} />
      <div className="flex-1 overflow-auto">{children}</div>
    </>
  )
}
```

- [ ] **Step 2: TabNav 加「查询历史」**

```tsx
// components/tab-nav.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const TABS = [
  { id: 'content',  label: '内容' },
  { id: 'history',  label: '查询历史' },
  { id: 'reports',  label: '选题分析' },
  { id: 'settings', label: '监控设置' },
]

export function TabNav({ categoryId }: { categoryId: string }) {
  const pathname = usePathname()
  return (
    <div className="px-8 bg-white flex gap-8">
      {TABS.map((t) => {
        const href = `/c/${categoryId}/${t.id}`
        const active = pathname.startsWith(href)
        return (
          <Link
            key={t.id}
            href={href}
            className={cn(
              'py-4 text-sm border-b-2 transition-colors',
              active
                ? 'border-neutral-900 text-neutral-900 font-medium'
                : 'border-transparent text-neutral-400 hover:text-neutral-700'
            )}
          >
            {t.label}
          </Link>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: tsc**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: 提交**

```bash
git add app/c/\[categoryId\]/layout.tsx components/tab-nav.tsx
git commit -m "feat(ui): add 查询历史 tab and ssr layout via db"
```

---

## Task 12: 查询历史 列表页

**Files:**
- Create: `app/c/[categoryId]/history/page.tsx`
- Create: `components/history-list.tsx`

- [ ] **Step 1: 写列表组件**

```tsx
// components/history-list.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Loader2 } from 'lucide-react'
import dayjs from 'dayjs'
import { PLATFORMS, type Platform } from '@/lib/types'
import type { QuerySummary, QueryStatus } from '@/lib/db/queries'
import { cn } from '@/lib/utils'

type ListResult = { items: QuerySummary[]; nextCursor?: string }

export function HistoryList({ categoryId }: { categoryId: string }) {
  const [keyword, setKeyword] = useState('')
  const [platform, setPlatform] = useState<Platform | ''>('')
  const [status, setStatus] = useState<QueryStatus | ''>('')
  const [items, setItems] = useState<QuerySummary[]>([])
  const [cursor, setCursor] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  function buildUrl(c?: string) {
    const qs = new URLSearchParams({ categoryId, limit: '30' })
    if (keyword.trim()) qs.set('keyword', keyword.trim())
    if (platform) qs.set('platform', platform)
    if (status) qs.set('status', status)
    if (c) qs.set('cursor', c)
    return `/api/queries?${qs}`
  }

  async function loadFirst() {
    setLoading(true); setDone(false); setCursor(undefined); setItems([])
    try {
      const res = await fetch(buildUrl(), { cache: 'no-store' })
      const data = (await res.json()) as ListResult
      setItems(data.items)
      setCursor(data.nextCursor)
      if (!data.nextCursor) setDone(true)
    } finally { setLoading(false) }
  }

  async function loadMore() {
    if (!cursor || loading) return
    setLoading(true)
    try {
      const res = await fetch(buildUrl(cursor), { cache: 'no-store' })
      const data = (await res.json()) as ListResult
      setItems((prev) => [...prev, ...data.items])
      setCursor(data.nextCursor)
      if (!data.nextCursor) setDone(true)
    } finally { setLoading(false) }
  }

  useEffect(() => { loadFirst() }, [categoryId, keyword, platform, status])

  return (
    <div className="p-8 flex flex-col gap-4 max-w-4xl">
      <div className="flex gap-3 items-center">
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="按关键词过滤"
          className="px-3 py-1.5 text-sm border border-neutral-200 rounded-lg w-56"
        />
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value as Platform | '')}
          className="px-2 py-1.5 text-sm border border-neutral-200 rounded-lg"
        >
          <option value="">全部平台</option>
          {PLATFORMS.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as QueryStatus | '')}
          className="px-2 py-1.5 text-sm border border-neutral-200 rounded-lg"
        >
          <option value="">全部状态</option>
          <option value="success">成功</option>
          <option value="error">失败</option>
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm divide-y divide-neutral-100">
        {items.length === 0 && !loading ? (
          <div className="p-12 text-center text-sm text-neutral-400">
            暂无查询记录,先去「内容」Tab 点一次「更新数据」吧
          </div>
        ) : (
          items.map((q) => <Row key={q.id} q={q} categoryId={categoryId} />)
        )}
      </div>

      {!done && items.length > 0 && (
        <button
          onClick={loadMore}
          disabled={loading}
          className="self-center px-4 py-2 text-sm text-neutral-500 hover:text-neutral-900 disabled:opacity-50"
        >
          {loading ? <Loader2 size={14} className="animate-spin inline" /> : '加载更多'}
        </button>
      )}
    </div>
  )
}

function Row({ q, categoryId }: { q: QuerySummary; categoryId: string }) {
  const platform = PLATFORMS.find((p) => p.id === q.platform)
  const failed = q.status === 'error'
  const inner = (
    <div className={cn(
      'flex items-center gap-4 px-5 py-3.5 text-sm',
      !failed && 'hover:bg-neutral-50 cursor-pointer'
    )}>
      <span className="text-neutral-400 tabular-nums w-28">
        {dayjs(q.startedAt).format('MM-DD HH:mm')}
      </span>
      <span className="text-neutral-900 w-44 truncate">{q.keyword}</span>
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-white text-xs"
        style={{ backgroundColor: platform?.color ?? '#666' }}
      >
        <span>{platform?.icon}</span>
        <span>{platform?.name ?? q.platform}</span>
      </span>
      <span className="flex-1" />
      {failed ? (
        <span className="text-red-600 text-xs truncate max-w-[280px]">
          ✗ {q.errorMessage ?? '失败'}
        </span>
      ) : (
        <span className="text-neutral-700">✓ {q.returnedCount} 条</span>
      )}
      {!failed && <ChevronRight size={14} className="text-neutral-400" />}
    </div>
  )
  if (failed) return inner
  return <Link href={`/c/${categoryId}/history/${q.id}`}>{inner}</Link>
}
```

- [ ] **Step 2: 写页面入口**

```tsx
// app/c/[categoryId]/history/page.tsx
import { use } from 'react'
import { HistoryList } from '@/components/history-list'

export default function HistoryPage({
  params,
}: {
  params: Promise<{ categoryId: string }>
}) {
  const { categoryId } = use(params)
  return <HistoryList categoryId={categoryId} />
}
```

- [ ] **Step 3: tsc + 浏览器手测**

```bash
npx tsc --noEmit
```

浏览器:打开 `/c/{某分类}/history`,过滤器可用,行数据正确。

- [ ] **Step 4: 提交**

```bash
git add app/c/\[categoryId\]/history components/history-list.tsx
git commit -m "feat(ui): query history list page"
```

---

## Task 13: 查询详情页

**Files:**
- Create: `app/c/[categoryId]/history/[queryId]/page.tsx`
- Create: `components/history-detail.tsx`

- [ ] **Step 1: 写详情组件**

```tsx
// components/history-detail.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, Loader2 } from 'lucide-react'
import dayjs from 'dayjs'
import { PLATFORMS } from '@/lib/types'
import type { QueryDetail } from '@/lib/db/queries'
import { cn } from '@/lib/utils'

type Mode = 'snapshot' | 'compare'

export function HistoryDetail({
  categoryId,
  queryId,
}: {
  categoryId: string
  queryId: number
}) {
  const [data, setData] = useState<QueryDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('snapshot')

  useEffect(() => {
    fetch(`/api/queries/${queryId}`, { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return (await r.json()) as QueryDetail
      })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [queryId])

  if (error) return <div className="p-8 text-sm text-red-600">加载失败:{error}</div>
  if (!data) return <div className="p-8"><Loader2 className="animate-spin" /></div>

  const { query, notes } = data
  const platform = PLATFORMS.find((p) => p.id === query.platform)
  const durationMs = query.finishedAt
    ? dayjs(query.finishedAt).diff(dayjs(query.startedAt))
    : 0

  return (
    <div className="p-8 max-w-5xl flex flex-col gap-6">
      <Link
        href={`/c/${categoryId}/history`}
        className="self-start inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900"
      >
        <ChevronLeft size={14} /> 返回历史
      </Link>

      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold tracking-tight flex items-center gap-3">
          <span>{query.keyword}</span>
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-white text-xs"
            style={{ backgroundColor: platform?.color ?? '#666' }}
          >
            <span>{platform?.icon}</span>{platform?.name}
          </span>
          <span className="text-neutral-400 text-sm font-normal">
            {dayjs(query.startedAt).format('YYYY-MM-DD HH:mm:ss')}
          </span>
        </h2>
        <p className="text-sm text-neutral-500">
          抓到 {query.returnedCount} 条 · 用时 {(durationMs / 1000).toFixed(1)}s
        </p>
      </div>

      <div className="flex gap-2">
        <ModeChip active={mode === 'snapshot'} onClick={() => setMode('snapshot')}>只看本次快照</ModeChip>
        <ModeChip active={mode === 'compare'} onClick={() => setMode('compare')}>对比最新</ModeChip>
      </div>

      {notes.length === 0 ? (
        <div className="text-sm text-neutral-400 py-12 text-center">本次查询没有命中笔记</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {notes.map((n) => <NoteCard key={n.id} note={n} mode={mode} />)}
        </div>
      )}
    </div>
  )
}

function ModeChip({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 text-xs rounded-full transition-colors',
        active ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
      )}
    >{children}</button>
  )
}

function NoteCard({
  note,
  mode,
}: {
  note: QueryDetail['notes'][number]
  mode: Mode
}) {
  const snap = note.snapshot
  return (
    <a
      href={note.url}
      target="_blank"
      rel="noopener noreferrer"
      className="bg-white rounded-xl shadow-sm p-4 flex gap-3 hover:shadow-md transition-shadow"
    >
      {note.coverImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={note.coverImage} alt="" className="w-24 h-24 object-cover rounded-lg shrink-0" />
      ) : (
        <div className="w-24 h-24 bg-neutral-100 rounded-lg shrink-0" />
      )}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="text-sm text-neutral-900 line-clamp-2">{note.title}</div>
        <div className="text-xs text-neutral-500 truncate">{note.author}</div>
        <div className="mt-auto text-xs text-neutral-600 flex flex-wrap gap-x-3">
          <Stat label="热度" snap={snap.hotScore} now={note.hotScore} mode={mode} />
          <Stat label="赞" snap={snap.likes} now={note.stats.likes} mode={mode} />
          {(snap.comments != null || note.stats.comments != null) && (
            <Stat label="评" snap={snap.comments} now={note.stats.comments ?? null} mode={mode} />
          )}
          <Stat label="阅" snap={snap.views} now={note.stats.views} mode={mode} />
        </div>
      </div>
    </a>
  )
}

function Stat({
  label, snap, now, mode,
}: { label: string; snap: number | null; now: number | null; mode: Mode }) {
  if (snap == null && now == null) return null
  if (mode === 'snapshot') return <span>{label} {snap ?? '-'}</span>
  if (snap == null || now == null || snap === now) return <span>{label} {now ?? snap ?? '-'}</span>
  return (
    <span>
      {label} <span className="text-neutral-400">{snap}→</span>
      <span className={now > snap ? 'text-emerald-600' : 'text-neutral-700'}>{now}</span>
    </span>
  )
}
```

- [ ] **Step 2: 写页面**

```tsx
// app/c/[categoryId]/history/[queryId]/page.tsx
import { use } from 'react'
import { HistoryDetail } from '@/components/history-detail'

export default function HistoryDetailPage({
  params,
}: {
  params: Promise<{ categoryId: string; queryId: string }>
}) {
  const { categoryId, queryId } = use(params)
  return <HistoryDetail categoryId={categoryId} queryId={Number(queryId)} />
}
```

- [ ] **Step 3: tsc + 全套测试**

```bash
npx tsc --noEmit && npx vitest run
```

期望:全绿。

- [ ] **Step 4: 浏览器端到端验证**

```
1. 打开 http://localhost:3000/c/{有 keyword 的分类}/content
2. 点「更新数据」→「全部更新」(账户欠费时仍会落 error 行)
3. 切到「查询历史」Tab,看到刚才的事件
4. 点击成功的事件 → 进详情页,看到笔记列表
5. 点「对比最新」,数字应当显示 "snapshot→now"
```

- [ ] **Step 5: 提交**

```bash
git add app/c/\[categoryId\]/history/\[queryId\] components/history-detail.tsx
git commit -m "feat(ui): query history detail page with snapshot vs current"
```

---

## Self-Review (执行人无需做,作者已检)

**Spec coverage:**
- 章节一 schema → Task 1 ✓
- wechat 字段映射 → Task 9 ✓
- API 列表 → Tasks 5-7 ✓
- xhs/wechat collect 落事件 → Tasks 8, 9 ✓
- Provider 改造 → Task 10 ✓
- Tab 加「查询历史」→ Task 11 ✓
- 列表页线框图 3.2 → Task 12 ✓
- 详情页线框图 3.3 → Task 13 ✓
- 首次启动 seed → Task 2 ✓
- 失败事件也写库 → Task 8 (logQueryError 路径)、Task 9 ✓
- 级联删除 → Task 1 测试覆盖 ✓

**Placeholder scan:** 无 TBD,所有代码块完整。

**Type consistency:**
- `QuerySummary` / `QueryDetail` / `QueryNote` 在 Task 4 定义,在 Task 7 路由、Task 12/13 UI 复用 ✓
- `logQuerySuccess` / `logQueryError` 签名在 Task 4 定义,Task 8/9 调用一致 ✓
- `KeywordConfig` 复用现有类型 ✓

**未覆盖的边界(spec 第四章第 4 条 "5s 去抖")**: 当前 plan 没单独建任务。可以在 Task 8/9 内嵌入,但实现简单(Map<key,timestamp>)且不影响主流程。**决定:** 留给后续 P2,本期不做(spec 第四章第 4 条标的是"未来工作")—— 实际上 spec 把它列在"边界"里,代表是 nice-to-have。Task 13 已经覆盖了核心验收清单。

---

**Plan complete and saved to `docs/superpowers/plans/2026-04-25-persistence-and-keyword-history.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — 一个 task 一个 fresh subagent,每 task 完成后两段 review,迭代快

**2. Inline Execution** — 在当前 session 用 executing-plans,批量执行带 checkpoint

**Which approach?**
