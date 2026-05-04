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
