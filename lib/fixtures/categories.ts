import type { Category } from '@/lib/types'

export const CATEGORIES_SEED: Category[] = [
  {
    id: 'claudecode',
    name: 'ClaudeCode 选题监控',
    createdAt: '2026-03-01',
    settings: {
      platforms: ['douyin', 'xiaohongshu', 'weibo', 'bilibili'],
      keywords: ['Claude Code', 'Anthropic', 'AI 编程助手', 'MCP', 'Subagent', 'Claude 工作流'],
      accounts: [
        { platform: 'bilibili',    handle: 'ai-coder-01',   displayName: 'AI 编程老王' },
        { platform: 'xiaohongshu', handle: 'vibecode_girl', displayName: 'Vibe Coding 小姐姐' },
        { platform: 'weibo',       handle: 'prompt_dad',    displayName: 'Prompt 老爸' },
      ],
    },
  },
  {
    id: 'vibecoding',
    name: 'Vibecoding 选题监控',
    createdAt: '2026-03-10',
    settings: {
      platforms: ['xiaohongshu', 'weibo', 'bilibili'],
      keywords: ['Vibe Coding', 'AI 结对编程', 'Cursor', '氛围编程'],
      accounts: [
        { platform: 'bilibili',    handle: 'fe-with-ai',    displayName: '前端 AI 玩家' },
        { platform: 'xiaohongshu', handle: 'nocode_lady',   displayName: '低代码女孩' },
      ],
    },
  },
  {
    id: 'ai-product',
    name: 'AI 产品监控',
    createdAt: '2026-03-15',
    settings: {
      platforms: ['douyin', 'xiaohongshu', 'weibo', 'bilibili'],
      keywords: ['AI Agent', 'AI 助手', 'ChatGPT', 'AI 产品', 'LLM 应用'],
      accounts: [
        { platform: 'weibo',    handle: 'ai_watcher',    displayName: 'AI 产品观察' },
        { platform: 'bilibili', handle: 'tech_reviewer', displayName: '硬核测评师' },
        { platform: 'douyin',   handle: 'ai_daily',      displayName: 'AI 日报君' },
      ],
    },
  },
]
