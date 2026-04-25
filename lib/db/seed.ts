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
