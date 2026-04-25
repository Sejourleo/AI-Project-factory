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
