import Database from 'better-sqlite3'
import path from 'node:path'
import fs from 'node:fs'
import { seedIfEmpty } from './seed'

const DB_DIR = path.join(process.cwd(), 'data')
const DB_PATH = path.join(DB_DIR, 'content.db')

let _db: Database.Database | null = null

export function applyMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS collected_notes (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      keyword TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      author TEXT NOT NULL,
      author_id TEXT,
      author_avatar TEXT,
      author_red_id TEXT,
      url TEXT NOT NULL,
      cover_image TEXT,
      published_at TEXT NOT NULL,
      collected_at TEXT NOT NULL,
      likes INTEGER NOT NULL DEFAULT 0,
      comments INTEGER,
      shares INTEGER,
      views INTEGER NOT NULL DEFAULT 0,
      hot_score INTEGER NOT NULL DEFAULT 0,
      tags TEXT NOT NULL DEFAULT '[]',
      raw TEXT NOT NULL DEFAULT '{}'
    );
    CREATE INDEX IF NOT EXISTS idx_notes_cat_plat_date
      ON collected_notes (category_id, platform, published_at);
    CREATE INDEX IF NOT EXISTS idx_notes_keyword
      ON collected_notes (category_id, platform, keyword);

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      created_at TEXT NOT NULL,
      accounts TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS keyword_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      value TEXT NOT NULL,
      platforms TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(category_id, value)
    );
    CREATE INDEX IF NOT EXISTS idx_keyword_configs_category
      ON keyword_configs(category_id);

    CREATE TABLE IF NOT EXISTS keyword_queries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      keyword TEXT NOT NULL,
      platform TEXT NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      status TEXT NOT NULL,
      returned_count INTEGER NOT NULL DEFAULT 0,
      error_message TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_queries_category_started
      ON keyword_queries(category_id, started_at DESC);

    CREATE TABLE IF NOT EXISTS query_notes (
      query_id INTEGER NOT NULL REFERENCES keyword_queries(id) ON DELETE CASCADE,
      note_id TEXT NOT NULL REFERENCES collected_notes(id),
      hot_score_snapshot INTEGER,
      likes_snapshot INTEGER,
      comments_snapshot INTEGER,
      views_snapshot INTEGER,
      PRIMARY KEY (query_id, note_id)
    );
    CREATE INDEX IF NOT EXISTS idx_query_notes_note
      ON query_notes(note_id);

    CREATE TABLE IF NOT EXISTS note_summaries (
      note_id TEXT PRIMARY KEY REFERENCES collected_notes(id) ON DELETE CASCADE,
      summary TEXT NOT NULL,
      keywords TEXT NOT NULL DEFAULT '[]',
      key_points TEXT NOT NULL DEFAULT '[]',
      highlights TEXT NOT NULL DEFAULT '[]',
      audience TEXT,
      model TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS topic_insights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      generated_at TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('success','error')),
      error_message TEXT,
      source_note_ids TEXT NOT NULL DEFAULT '[]',
      insights TEXT NOT NULL DEFAULT '[]',
      model TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_topic_insights_cat_time
      ON topic_insights(category_id, generated_at DESC);
  `)
}

export function getDb(): Database.Database {
  if (_db) return _db
  fs.mkdirSync(DB_DIR, { recursive: true })
  const db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  applyMigrations(db)
  seedIfEmpty(db)
  _db = db
  return db
}

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
  tags: string
  raw: string
}
