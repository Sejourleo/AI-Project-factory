import { describe, it, expect } from 'vitest'
import {
  NOTE_SUMMARY_SCHEMA, INSIGHTS_SCHEMA,
  buildNoteSummaryPrompt, buildInsightsPrompt,
} from '@/lib/llm/prompts'

describe('prompts', () => {
  it('NOTE_SUMMARY_SCHEMA: 必填字段齐全', () => {
    expect(NOTE_SUMMARY_SCHEMA.type).toBe('object')
    const required = (NOTE_SUMMARY_SCHEMA as { required: string[] }).required
    expect(required).toEqual(['summary', 'keywords', 'keyPoints', 'highlights'])
  })

  it('INSIGHTS_SCHEMA: insights 数组,每项含 7 字段', () => {
    const props = (INSIGHTS_SCHEMA as { properties: Record<string, unknown> }).properties
    expect(props.insights).toBeDefined()
    const items = (props.insights as { items: { required: string[] } }).items
    expect(items.required).toEqual([
      'title', 'angle', 'evidenceNoteIds',
      'audience', 'contentFormat', 'differentiation', 'tags',
    ])
  })

  it('buildNoteSummaryPrompt: 标题/作者/平台拼到 user', () => {
    const p = buildNoteSummaryPrompt({
      platform: 'xiaohongshu',
      title: 'AI 编程入门',
      author: '小明',
      summary: '简介',
      raw: 'long article body ...',
    })
    expect(p.system).toContain('内容分析助手')
    expect(p.user).toContain('AI 编程入门')
    expect(p.user).toContain('小明')
    expect(p.user).toContain('xiaohongshu')
  })

  it('buildNoteSummaryPrompt: raw 截断到 2000 字符', () => {
    const longRaw = 'x'.repeat(5000)
    const p = buildNoteSummaryPrompt({
      platform: 'wechat', title: 'T', author: 'A', summary: 'S', raw: longRaw,
    })
    expect(p.user.length).toBeLessThan(3000)
    expect(p.user).toContain('...(截断)')
  })

  it('buildInsightsPrompt: 含分类名 + 笔记数量提示', () => {
    const p = buildInsightsPrompt({
      categoryName: 'Claude Code',
      summaries: [
        { noteId: 'n1', title: 'T1', hotScore: 80, platform: 'xiaohongshu',
          summary: 's1', keywords: ['k'], keyPoints: ['p'], highlights: ['h'] },
        { noteId: 'n2', title: 'T2', hotScore: 70, platform: 'wechat',
          summary: 's2', keywords: [], keyPoints: [], highlights: [] },
      ],
    })
    expect(p.system).toContain('选题策划')
    expect(p.system).toContain('至少 5 条')
    expect(p.user).toContain('Claude Code')
    expect(p.user).toContain('n1')
    expect(p.user).toContain('n2')
  })
})
