import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { applyMigrations } from '@/lib/db/client'
import { createCategory } from '@/lib/db/categories'
import { runInsightsPipeline } from '@/app/api/insights/generate/route'
import {
  getLatestInsightSnapshot, getNoteSummaries,
} from '@/lib/db/insights'

let db: Database.Database
beforeEach(() => {
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  applyMigrations(db)
})
afterEach(() => { vi.restoreAllMocks() })

function seedNote(id: string, categoryId: string, hotScore: number) {
  db.prepare(`
    INSERT INTO collected_notes
      (id, category_id, platform, keyword, title, summary, author, url,
       published_at, collected_at, hot_score, raw)
    VALUES (?, ?, 'xiaohongshu', 'kw', 'T-'||?, 'S', 'A', 'http://x',
            '2026-04-26', '2026-04-26', ?, '{"orig":true}')
  `).run(id, categoryId, id, hotScore)
}

describe('runInsightsPipeline', () => {
  it('Stage 1 + Stage 2 串起来,写库,返回 snapshotId', async () => {
    const c = createCategory(db, { name: 'Cat1' })
    seedNote('n1', c.id, 90); seedNote('n2', c.id, 80)
    const llm = {
      modelId: 'mock-model',
      generateStructured: vi.fn()
        .mockResolvedValueOnce({
          summary: 's1', keywords: ['k1'], keyPoints: ['p1'], highlights: ['h1'],
        })
        .mockResolvedValueOnce({
          summary: 's2', keywords: ['k2'], keyPoints: ['p2'], highlights: ['h2'],
        })
        .mockResolvedValueOnce({
          insights: [
            { title: 'T1', angle: 'A1', evidenceNoteIds: ['n1'],
              audience: 'aud', contentFormat: 'fmt',
              differentiation: 'diff', tags: ['x'] },
            { title: 'T2', angle: 'A2', evidenceNoteIds: ['n2'],
              audience: 'aud', contentFormat: 'fmt',
              differentiation: 'diff', tags: ['x'] },
            { title: 'T3', angle: 'A3', evidenceNoteIds: [],
              audience: 'aud', contentFormat: 'fmt',
              differentiation: 'diff', tags: ['x'] },
            { title: 'T4', angle: 'A4', evidenceNoteIds: [],
              audience: 'aud', contentFormat: 'fmt',
              differentiation: 'diff', tags: ['x'] },
            { title: 'T5', angle: 'A5', evidenceNoteIds: [],
              audience: 'aud', contentFormat: 'fmt',
              differentiation: 'diff', tags: ['x'] },
          ],
        }),
    }
    const result = await runInsightsPipeline(db, llm, c.id)
    expect(result.snapshotId).toBeGreaterThan(0)
    expect(result.insightsCount).toBe(5)
    expect(result.sourceCount).toBe(2)
    expect(llm.generateStructured).toHaveBeenCalledTimes(3)

    const snap = getLatestInsightSnapshot(db, c.id)!
    expect(snap.status).toBe('success')
    expect(snap.insights).toHaveLength(5)
    expect(snap.sourceNoteIds).toEqual(expect.arrayContaining(['n1','n2']))
  })

  it('Stage 1 命中缓存时不再调用 LLM', async () => {
    const c = createCategory(db, { name: 'Cat1' })
    seedNote('n1', c.id, 90)
    db.prepare(`
      INSERT INTO note_summaries
        (note_id, summary, keywords, key_points, highlights, audience, model, created_at)
      VALUES ('n1', 'cached', '["c"]', '[]', '[]', NULL, 'old-model', '2026-04-26')
    `).run()
    const llm = {
      modelId: 'mock',
      generateStructured: vi.fn().mockResolvedValueOnce({
        insights: Array.from({ length: 5 }, (_, i) => ({
          title: `T${i}`, angle: 'a', evidenceNoteIds: [],
          audience: 'aud', contentFormat: 'fmt',
          differentiation: 'd', tags: [],
        })),
      }),
    }
    await runInsightsPipeline(db, llm, c.id)
    expect(llm.generateStructured).toHaveBeenCalledTimes(1)
    const map = getNoteSummaries(db, ['n1'])
    expect(map.get('n1')?.summary).toBe('cached')
  })

  it('Top 笔记为 0 时,跳过 Stage 1,Stage 2 仍跑(基于空摘要)', async () => {
    const c = createCategory(db, { name: 'Cat1' })
    const llm = {
      modelId: 'mock',
      generateStructured: vi.fn().mockResolvedValueOnce({
        insights: Array.from({ length: 5 }, (_, i) => ({
          title: `T${i}`, angle: 'a', evidenceNoteIds: [],
          audience: 'aud', contentFormat: 'fmt',
          differentiation: 'd', tags: [],
        })),
      }),
    }
    const r = await runInsightsPipeline(db, llm, c.id)
    expect(r.sourceCount).toBe(0)
    expect(llm.generateStructured).toHaveBeenCalledTimes(1)
  })

  it('Stage 2 失败 → 写入 error 行,抛错', async () => {
    const c = createCategory(db, { name: 'Cat1' })
    seedNote('n1', c.id, 90)
    const llm = {
      modelId: 'mock',
      generateStructured: vi.fn()
        .mockResolvedValueOnce({
          summary: 's', keywords: [], keyPoints: [], highlights: [],
        })
        .mockRejectedValueOnce(new Error('LLM 502')),
    }
    await expect(runInsightsPipeline(db, llm, c.id)).rejects.toThrow(/LLM 502/)
    const snap = getLatestInsightSnapshot(db, c.id)!
    expect(snap.status).toBe('error')
    expect(snap.errorMessage).toContain('LLM 502')
  })

  it('Stage 1 单篇失败被吞,不阻塞整体', async () => {
    const c = createCategory(db, { name: 'Cat1' })
    seedNote('n1', c.id, 90); seedNote('n2', c.id, 80)
    const llm = {
      modelId: 'mock',
      generateStructured: vi.fn()
        .mockRejectedValueOnce(new Error('one bad'))
        .mockResolvedValueOnce({
          summary: 's2', keywords: [], keyPoints: [], highlights: [],
        })
        .mockResolvedValueOnce({
          insights: Array.from({ length: 5 }, () => ({
            title: 't', angle: 'a', evidenceNoteIds: [],
            audience: 'aud', contentFormat: 'fmt',
            differentiation: 'd', tags: [],
          })),
        }),
    }
    const r = await runInsightsPipeline(db, llm, c.id)
    expect(r.sourceCount).toBe(1)
    expect(r.snapshotId).toBeGreaterThan(0)
  })
})
