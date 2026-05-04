import { existsSync } from 'node:fs'

// vitest 不像 Next.js 那样自动读 .env.local；测试启动前手动注入
if (existsSync('.env.local')) {
  process.loadEnvFile('.env.local')
}

// 兜底默认（dev docker compose）
if (!process.env.POSTGRES_URL) {
  process.env.POSTGRES_URL = 'postgres://dev:dev@localhost:5432/content_factory'
}
