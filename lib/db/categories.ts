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
