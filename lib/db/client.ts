import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg'
import { applyMigrations } from './migrations'
import { seedIfEmpty } from './seed'

if (!process.env.POSTGRES_URL) {
  throw new Error(
    'POSTGRES_URL is not set. Locally: run `docker compose up -d` and copy .env.example to .env.local',
  )
}

export const pool = new Pool({ connectionString: process.env.POSTGRES_URL })

// Tagged template literal mimicking @vercel/postgres's `sql` shape but backed
// by node-postgres. Lets every consumer continue to write `await sql\`SELECT ${x}\`` etc.
export function sql<T extends QueryResultRow = QueryResultRow>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<QueryResult<T>> {
  let text = strings[0]
  for (let i = 0; i < values.length; i++) {
    text += `$${i + 1}` + strings[i + 1]
  }
  return pool.query<T>(text, values as unknown[])
}

// `db.query()` / `db.connect()` shape — same as @vercel/postgres so call sites don't change.
export const db = {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<T>> {
    return pool.query<T>(text, values as unknown[])
  },
  connect(): Promise<PoolClient> {
    return pool.connect()
  },
}

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

// NoteRow 类型对应 collected_notes 表的一行；JSONB 列（tags / raw）已是 JS 值
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
