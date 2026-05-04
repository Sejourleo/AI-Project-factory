import { describe, it, expect, beforeEach } from 'vitest'
import { sql } from '@/lib/db/client'
import { ensureSchema, truncateAll } from './_helpers'

beforeEach(async () => {
  await ensureSchema()
  await truncateAll()
})

describe('db schema', () => {
  it('applyMigrations 创建所有表', async () => {
    const { rows } = await sql<{ table_name: string }>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `
    const names = rows.map((r) => r.table_name)
    expect(names).toEqual(expect.arrayContaining([
      'categories',
      'collected_notes',
      'keyword_configs',
      'keyword_queries',
      'query_notes',
    ]))
  })

  it('外键级联:删除 category 自动清 keyword_configs / keyword_queries / query_notes', async () => {
    await sql`INSERT INTO categories (id, name, color, created_at) VALUES (${'c1'}, ${'测'}, ${'#000'}, ${'2026-04-25'})`
    await sql`INSERT INTO keyword_configs (category_id, value, platforms, created_at) VALUES (${'c1'}, ${'kw'}, ${'[]'}::jsonb, ${'2026-04-25'})`
    await sql`DELETE FROM categories WHERE id = ${'c1'}`
    const { rows } = await sql<{ n: number }>`SELECT count(*)::int AS n FROM keyword_configs`
    expect(rows[0].n).toBe(0)
  })
})
