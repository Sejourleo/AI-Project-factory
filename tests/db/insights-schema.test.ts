import { describe, it, expect, beforeEach } from 'vitest'
import { sql } from '@/lib/db/client'
import { ensureSchema, truncateAll } from './_helpers'

beforeEach(async () => {
  await ensureSchema()
  await truncateAll()
})

describe('insights schema', () => {
  it('note_summaries 表存在,FK 级联删除', async () => {
    await sql`INSERT INTO categories (id, name, color, created_at) VALUES (${'c1'}, ${'C'}, ${'#000'}, ${'2026-04-26'})`
    await sql`
      INSERT INTO collected_notes
        (id, category_id, platform, keyword, title, summary, author, url,
         published_at, collected_at)
      VALUES (${'n1'}, ${'c1'}, ${'xiaohongshu'}, ${'kw'}, ${'T'}, ${'S'}, ${'A'}, ${'http://x'},
              ${'2026-04-26'}, ${'2026-04-26'})
    `
    await sql`
      INSERT INTO note_summaries
        (note_id, summary, keywords, key_points, highlights, audience, model, created_at)
      VALUES (${'n1'}, ${'s'}, ${'[]'}::jsonb, ${'[]'}::jsonb, ${'[]'}::jsonb, NULL, ${'m'}, ${'2026-04-26'})
    `
    await sql`DELETE FROM collected_notes WHERE id = ${'n1'}`
    const { rows } = await sql`SELECT * FROM note_summaries WHERE note_id = ${'n1'}`
    expect(rows).toHaveLength(0)
  })

  it('topic_insights 表存在,FK 级联', async () => {
    await sql`INSERT INTO categories (id, name, color, created_at) VALUES (${'c1'}, ${'C'}, ${'#000'}, ${'2026-04-26'})`
    const { rows: ins } = await sql<{ id: number }>`
      INSERT INTO topic_insights
        (category_id, generated_at, status, source_note_ids, insights, model)
      VALUES (${'c1'}, ${'2026-04-26T10:00:00Z'}, ${'success'}, ${'["n1"]'}::jsonb, ${'[]'}::jsonb, ${'m'})
      RETURNING id
    `
    const insertedId = ins[0].id
    expect(typeof insertedId).toBe('number')

    await sql`DELETE FROM categories WHERE id = ${'c1'}`
    const { rows } = await sql`SELECT * FROM topic_insights WHERE id = ${insertedId}`
    expect(rows).toHaveLength(0)
  })
})
