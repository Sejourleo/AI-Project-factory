import { describe, it, expect, beforeEach } from 'vitest'
import { sql } from '@/lib/db/client'
import { seedIfEmpty } from '@/lib/db/seed'
import { CATEGORIES_SEED } from '@/lib/fixtures/categories'
import { ensureSchema, truncateAll } from './_helpers'

beforeEach(async () => {
  await ensureSchema()
  await truncateAll()
})

describe('seedIfEmpty', () => {
  it('空库 → 插入种子分类与关键词', async () => {
    await seedIfEmpty()
    const { rows: cats } = await sql<{ id: string }>`SELECT id FROM categories ORDER BY id`
    expect(cats.map((c) => c.id)).toEqual(CATEGORIES_SEED.map((c) => c.id).sort())
    const { rows: kwRows } = await sql<{ n: number }>`SELECT count(*)::int AS n FROM keyword_configs`
    const expectedKwCount = CATEGORIES_SEED.flatMap((c) => c.settings.keywords).length
    expect(kwRows[0].n).toBe(expectedKwCount)
  })

  it('再次调用幂等 → 不重复插入', async () => {
    await seedIfEmpty()
    await seedIfEmpty()
    const { rows } = await sql<{ n: number }>`SELECT count(*)::int AS n FROM categories`
    expect(rows[0].n).toBe(CATEGORIES_SEED.length)
  })

  it('已有分类 → 不动种子', async () => {
    await sql`INSERT INTO categories (id, name, color, created_at) VALUES (${'custom'}, ${'自定义'}, ${'#000'}, ${'2026-04-25'})`
    await seedIfEmpty()
    const { rows } = await sql<{ id: string }>`SELECT id FROM categories`
    expect(rows.map((c) => c.id)).toEqual(['custom'])
  })
})
