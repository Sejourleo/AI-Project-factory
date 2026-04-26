import type { Platform } from '@/lib/types'

export const NOTE_SUMMARY_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string', description: '一段 80-200 字的中文摘要' },
    keywords: {
      type: 'array', items: { type: 'string' },
      description: '3-8 个核心关键词',
    },
    keyPoints: {
      type: 'array', items: { type: 'string' },
      description: '3-6 条原文核心信息(陈述句)',
    },
    highlights: {
      type: 'array', items: { type: 'string' },
      description: '2-5 条值得注意的亮点(独特视角/反常识/数据)',
    },
    audience: { type: 'string', description: '目标受众 / 内容角度,可选' },
  },
  required: ['summary', 'keywords', 'keyPoints', 'highlights'],
}

export const INSIGHTS_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  properties: {
    insights: {
      type: 'array',
      minItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string', description: '选题标题(吸睛 + 信息密度)' },
          angle: { type: 'string', description: '切入点(为什么是这个角度)' },
          evidenceNoteIds: {
            type: 'array', items: { type: 'string' },
            description: '论据笔记 id(必须从输入摘要的 noteId 中选)',
          },
          audience: { type: 'string', description: '目标受众' },
          contentFormat: { type: 'string', description: '内容形式(短视频/长文/合集/...)' },
          differentiation: { type: 'string', description: '相对现有内容的差异化突破点' },
          tags: {
            type: 'array', items: { type: 'string' },
            description: '2-5 个分类标签',
          },
        },
        required: [
          'title', 'angle', 'evidenceNoteIds', 'audience',
          'contentFormat', 'differentiation', 'tags',
        ],
      },
    },
  },
  required: ['insights'],
}

const RAW_LIMIT = 2000

export function buildNoteSummaryPrompt(note: {
  platform: Platform | string
  title: string
  author: string
  summary: string
  raw: string
}): { system: string; user: string } {
  const trimmedRaw = note.raw.length > RAW_LIMIT
    ? note.raw.slice(0, RAW_LIMIT) + '...(截断)'
    : note.raw
  return {
    system:
      '你是内容分析助手。从输入的一篇笔记中抽取结构化信息，' +
      '用于后续选题洞察生成。严格按 JSON Schema 输出，不要解释，不要寒暄。',
    user: [
      `平台: ${note.platform}`,
      `标题: ${note.title}`,
      `作者: ${note.author}`,
      `摘要: ${note.summary}`,
      `原文: ${trimmedRaw}`,
    ].join('\n'),
  }
}

export function buildInsightsPrompt(args: {
  categoryName: string
  summaries: Array<{
    noteId: string
    title: string
    hotScore: number
    platform: Platform | string
    summary: string
    keywords: string[]
    keyPoints: string[]
    highlights: string[]
    audience?: string
  }>
}): { system: string; user: string } {
  return {
    system:
      '你是资深内容选题策划。基于输入的若干篇热门笔记的结构化摘要，' +
      '生成至少 5 条可执行的选题洞察。' +
      '每条要给出独特角度、目标受众、论据笔记(从输入 noteId 中选)、内容形式建议、差异化突破点。' +
      '严格按 JSON Schema 输出 { insights: TopicInsight[] }，不要解释，不要寒暄。',
    user: [
      `分类: ${args.categoryName}`,
      `共 ${args.summaries.length} 篇热门笔记摘要：`,
      JSON.stringify(args.summaries, null, 2),
    ].join('\n'),
  }
}
