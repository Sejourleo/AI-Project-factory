import { sql, db } from '@vercel/postgres'
import { applyMigrations } from './migrations'
import { seedIfEmpty } from './seed'

export { sql, db }

// 每个 lambda/process 实例只跑一次 migrations + seed
let _migrated: Promise<void> | null = null

export function ensureMigrated(): Promise<void> {
  if (_migrated) return _migrated
  _migrated = (async () => {
    await applyMigrations()
    await seedIfEmpty()
  })()
  return _migrated
}

// NoteRow 类型对应 collected_notes 表的一行；与 SQLite 版相比，
// JSONB 列（tags / raw）现在直接是 JS 值，不再是字符串
export type NoteRow = {
  id: string
  category_id: string
  platform: string
  keyword: string
  title: string
  summary: string
  author: string
  author_id: string | null
  author_avatar: string | null
  author_red_id: string | null
  url: string
  cover_image: string | null
  published_at: string
  collected_at: string
  likes: number
  comments: number | null
  shares: number | null
  views: number
  hot_score: number
  tags: string[]
  raw: Record<string, unknown>
}
