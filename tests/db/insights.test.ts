import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { applyMigrations } from '@/lib/db/client'
import { createCategory } from '@/lib/db/categories'
import {
  upsertNoteSummary, getNoteSummaries,
  insertInsightSnapshot, getInsightSnapshot,
  getLatestInsightSnapshot, listInsightSnapshots,
} from '@/lib/db/insights'

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
       published_at, collected_at)
    VALUES (?, ?, 'xiaohongshu', 'kw', 'T', 'S', 'A', 'http://x',
            '2026-04-26', '2026-04-26')
  `).run(id, categoryId)
}

describe('insights DB', () => {
  it('upsertNoteSummary 永久缓存,二次插入忽略', () => {
    const c = createCategory(db, { name: 'C' })
    seedNote('n1', c.id)
    upsertNoteSummary(db, {
      noteId: 'n1', summary: 'first',
      keywords: ['a'], keyPoints: ['kp'], highlights: ['h'],
      audience: 'devs', model: 'm1',
    })
    upsertNoteSummary(db, {
      noteId: 'n1', summary: 'second',  // 应被忽略
      keywords: [], keyPoints: [], highlights: [],
      model: 'm2',
    })
    const map = getNoteSummaries(db, ['n1'])
    expect(map.get('n1')?.summary).toBe('first')
    expect(map.get('n1')?.keywords).toEqual(['a'])
  })

  it('getNoteSummaries 仅返回命中行,顺序不保证', () => {
    const c = createCategory(db, { name: 'C' })
    seedNote('n1', c.id); seedNote('n2', c.id)
    upsertNoteSummary(db, {
      noteId: 'n1', summary: 's', keywords: [], keyPoints: [],
      highlights: [], model: 'm',
    })
    const map = getNoteSummaries(db, ['n1', 'n2', 'n3'])
    expect(map.size).toBe(1)
    expect(map.has('n1')).toBe(true)
  })

  it('insertInsightSnapshot + getLatestInsightSnapshot', () => {
    const c = createCategory(db, { name: 'C' })
    const id1 = insertInsightSnapshot(db, {
      categoryId: c.id, generatedAt: '2026-04-26T10:00:00Z',
      status: 'success', sourceNoteIds: ['n1', 'n2'],
      insights: [{
        title: 'T', angle: 'A', evidenceNoteIds: ['n1'],
        audience: 'aud', contentFormat: 'fmt',
        differentiation: 'diff', tags: ['x'],
      }],
      model: 'm',
    })
    const id2 = insertInsightSnapshot(db, {
      categoryId: c.id, generatedAt: '2026-04-26T11:00:00Z',
      status: 'success', sourceNoteIds: [], insights: [], model: 'm',
    })
    expect(id2).toBeGreaterThan(id1)
    const latest = getLatestInsightSnapshot(db, c.id)!
    expect(latest.id).toBe(id2)
    const fetched = getInsightSnapshot(db, id1)!
    expect(fetched.insights[0].title).toBe('T')
    expect(fetched.sourceNoteIds).toEqual(['n1', 'n2'])
  })

  it('listInsightSnapshots 倒序 + 翻页', () => {
    const c = createCategory(db, { name: 'C' })
    for (let i = 0; i < 3; i++) {
      insertInsightSnapshot(db, {
        categoryId: c.id,
        generatedAt: `2026-04-26T1${i}:00:00Z`,
        status: 'success', sourceNoteIds: [], insights: [], model: 'm',
      })
    }
    const page1 = listInsightSnapshots(db, { categoryId: c.id, limit: 2 })
    expect(page1.items).toHaveLength(2)
    expect(page1.items[0].generatedAt).toBe('2026-04-26T12:00:00Z')
    expect(page1.nextCursor).toBeDefined()
    const page2 = listInsightSnapshots(db, { categoryId: c.id, limit: 2, cursor: page1.nextCursor })
    expect(page2.items).toHaveLength(1)
    expect(page2.nextCursor).toBeUndefined()
  })

  it('error 状态快照 — error_message 透传', () => {
    const c = createCategory(db, { name: 'C' })
    const id = insertInsightSnapshot(db, {
      categoryId: c.id, generatedAt: '2026-04-26T10:00:00Z',
      status: 'error', errorMessage: 'LLM 超时',
      sourceNoteIds: [], insights: [], model: 'm',
    })
    const got = getInsightSnapshot(db, id)!
    expect(got.status).toBe('error')
    expect(got.errorMessage).toBe('LLM 超时')
  })
})
