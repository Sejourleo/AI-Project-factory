import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { applyMigrations } from '@/lib/db/client'

let db: Database.Database

beforeEach(() => {
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  applyMigrations(db)
})

describe('insights schema', () => {
  it('note_summaries 表存在,FK 级联删除', () => {
    db.prepare(`INSERT INTO categories (id, name, color, created_at)
                VALUES ('c1', 'C', '#000', '2026-04-26')`).run()
    db.prepare(`
      INSERT INTO collected_notes
        (id, category_id, platform, keyword, title, summary, author, url,
         published_at, collected_at)
      VALUES ('n1', 'c1', 'xiaohongshu', 'kw', 'T', 'S', 'A', 'http://x',
              '2026-04-26', '2026-04-26')
    `).run()
    db.prepare(`
      INSERT INTO note_summaries
        (note_id, summary, keywords, key_points, highlights, audience, model, created_at)
      VALUES ('n1', 's', '[]', '[]', '[]', NULL, 'm', '2026-04-26')
    `).run()
    db.prepare(`DELETE FROM collected_notes WHERE id = 'n1'`).run()
    const row = db.prepare(`SELECT * FROM note_summaries WHERE note_id = 'n1'`).get()
    expect(row).toBeUndefined()
  })

  it('topic_insights 表存在,FK 级联,索引可用', () => {
    db.prepare(`INSERT INTO categories (id, name, color, created_at)
                VALUES ('c1', 'C', '#000', '2026-04-26')`).run()
    const info = db.prepare(`
      INSERT INTO topic_insights
        (category_id, generated_at, status, source_note_ids, insights, model)
      VALUES ('c1', '2026-04-26T10:00:00Z', 'success', '["n1"]', '[]', 'm')
    `).run()
    expect(info.lastInsertRowid).toBeTypeOf('number')
    db.prepare(`DELETE FROM categories WHERE id = 'c1'`).run()
    const row = db.prepare(`SELECT * FROM topic_insights WHERE id = ?`).get(info.lastInsertRowid)
    expect(row).toBeUndefined()
  })
})
