import type { DailyReport, TopicSuggestion } from '@/lib/types'
import { CATEGORIES_SEED } from './categories'
import { pastNDays } from '@/lib/utils/dates'

const TOPIC_LIB: Record<string, Array<Omit<TopicSuggestion, 'id' | 'relatedContentIds'>>> = {
  claudecode: [
    {
      title: 'Claude Code 独立开发者工作流全拆解',
      brief: {
        why:    '独立开发者是 Claude Code 的核心增长人群，对完整工作流内容需求旺盛。',
        hook:   '"一人一天做完一个 MVP"的真实案例，可视化对比传统开发耗时。',
        growth: '视频 + 配套模板下载，评论区转化率高，相关搜索词月增 120%。',
      },
      tags: ['工作流', '独立开发', '入门教程'],
    },
    {
      title: 'MCP 工具链入门：从零到接管你的开发环境',
      brief: {
        why:    'MCP 是 Claude Code 生态最快速增长的技术话题，但入门门槛让大量用户被劝退。',
        hook:   '"5 分钟装好第一个 MCP Server" 的短视频拆解，降低认知门槛。',
        growth: '技术型账号容易建立专业度，适合系列化内容铺排。',
      },
      tags: ['MCP', '入门教程', '技术拆解'],
    },
    {
      title: '三款神级 Subagent 拆解',
      brief: {
        why:    'Subagent 是近期讨论度最高的 Claude 新特性，用户需要具体模板参考。',
        hook:   '"别人家的 Subagent 配置"系列，对比呈现产出效果差异。',
        growth: '模板下载能做私域转化，长尾价值高。',
      },
      tags: ['Subagent', '模板', '工作流'],
    },
    {
      title: 'Claude Hooks 系统深度拆解',
      brief: {
        why:    'Hooks 让 Claude Code 可编程化，是进阶用户的分水岭，高阶用户需求旺盛。',
        hook:   '"用 Hooks 让 Claude 自动 commit 并推送"这类具体场景示范。',
        growth: '配合 GitHub 开源模板，能吸引技术社区。',
      },
      tags: ['Hooks', '进阶', '自动化'],
    },
    {
      title: 'Cursor vs Claude Code 2026 深度对比',
      brief: {
        why:    '用户选型时的高频搜索主题，对比类内容天然传播性强。',
        hook:   '同一个任务用两款工具完成，量化耗时与代码质量。',
        growth: '争议性内容自带评论，账号互动数据可观。',
      },
      tags: ['对比评测', '选型', 'Cursor'],
    },
  ],
  vibecoding: [
    {
      title: 'Vibe Coding 正在重塑程序员的一天',
      brief: {
        why:    'Vibe Coding 概念刚被大众认识，科普类内容窗口期还在。',
        hook:   '"我放下键盘让 AI 写代码，自己去喝咖啡"的真实日程 vlog。',
        growth: '非程序员也能看懂，容易破圈。',
      },
      tags: ['科普', 'Vibe Coding', '日常'],
    },
    {
      title: '前端工程师的 Vibe Coding 实践指南',
      brief: {
        why:    '前端是 Vibe Coding 落地最快的领域，具体实践需求大。',
        hook:   '"3 小时搭完落地页，全程没写一行 CSS" 的案例拆解。',
        growth: '前端社区活跃度高，二次传播率好。',
      },
      tags: ['前端', '案例', '实操'],
    },
    {
      title: '用 AI 结对编程一个月后，我还有没有失业',
      brief: {
        why:    '存在感焦虑是程序员的普遍情绪，争议性话题流量高。',
        hook:   '"一个月后我的真实感受"，情绪 + 数据双重支撑。',
        growth: '能引发评论区长尾讨论。',
      },
      tags: ['观点', '职业发展', '争议'],
    },
    {
      title: '10 个 Vibe Coding 必备 Prompt 合集',
      brief: {
        why:    '实用工具型内容始终有稳定需求，收藏率高。',
        hook:   '"收藏就能直接用"的合集类视觉设计。',
        growth: '可做系列化，按场景细分。',
      },
      tags: ['Prompt', '工具', '合集'],
    },
  ],
  'ai-product': [
    {
      title: '2026 值得付费的 10 款 AI 产品',
      brief: {
        why:    '用户对付费 AI 产品的选型焦虑持续存在，年度榜单有流量惯性。',
        hook:   '真实付费使用 3 个月后的深度体感，而非 demo 体验。',
        growth: '可做成年度账号系列化 IP。',
      },
      tags: ['盘点', '付费', '选型'],
    },
    {
      title: '第一批 AI Agent 商业化产品深度测评',
      brief: {
        why:    'AI Agent 正从概念走向产品，早期测评有先发优势。',
        hook:   '"让它替我完成一天的工作，看能做到什么程度"。',
        growth: '能建立垂类测评号的专业度。',
      },
      tags: ['Agent', '测评', '商业化'],
    },
    {
      title: '从 Chat 到 Agent：AI 产品形态的演进逻辑',
      brief: {
        why:    '产品经理与投资人关注的框架性内容，专业受众付费意愿高。',
        hook:   '用一张演进图理清赛道，结构化叙述。',
        growth: '行业号转发率高，适合建立 thought leadership。',
      },
      tags: ['行业观察', '产品', '演进'],
    },
    {
      title: '大厂 AI 产品到底赚不赚钱',
      brief: {
        why:    '财报数据 + 商业分析能建立深度账号定位。',
        hook:   '拆解头部公司 AI 业务营收占比。',
        growth: '数据型内容易被引用与二次传播。',
      },
      tags: ['商业分析', '大厂', '营收'],
    },
  ],
}

const HOTSPOTS: Record<string, string[]> = {
  claudecode: [
    '独立开发者一人多角色工作流',
    'MCP 官方工具库更新',
    'Subagent 最佳实践模板流出',
    'Claude Hooks 自动化场景',
    'Claude Code vs Cursor 二次讨论',
  ],
  vibecoding: [
    'Cursor 新版插件体验',
    'AI 前端工程师的招聘需求',
    '低代码 vs Vibe Coding 争论',
    '非技术创始人用 AI 写代码',
  ],
  'ai-product': [
    'OpenAI 新产品发布',
    'AI Agent 商业化进展',
    '国产 AI 助手新动态',
    '大模型 API 价格变化',
  ],
}

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

function generateReport(categoryId: string, date: string): DailyReport {
  const seed = hash(`${categoryId}-${date}`)
  const pool = TOPIC_LIB[categoryId] ?? TOPIC_LIB.claudecode
  const hotspots = HOTSPOTS[categoryId] ?? HOTSPOTS.claudecode
  const topicCount = 3 + (seed % 3)  // 3-5
  const topics: TopicSuggestion[] = []
  for (let i = 0; i < topicCount; i++) {
    const t = pool[(seed + i) % pool.length]
    topics.push({
      id: `${categoryId}-${date}-t${i}`,
      title: t.title,
      brief: t.brief,
      tags: t.tags,
      relatedContentIds: [
        `${categoryId}-${date}-${i * 2}`,
        `${categoryId}-${date}-${i * 2 + 1}`,
        `${categoryId}-${date}-${i * 2 + 2}`,
      ],
    })
  }
  return {
    id: `${categoryId}-report-${date}`,
    categoryId,
    date,
    summary: topics[0].title,
    yesterdayHotspots: hotspots.slice(0, 3 + (seed % 2)),
    topics,
    analyzedContentIds: Array.from({ length: 10 }, (_, i) => `${categoryId}-${date}-${i}`),
  }
}

export const REPORTS_SEED: DailyReport[] = (() => {
  const days = pastNDays(7)
  const reports: DailyReport[] = []
  for (const cat of CATEGORIES_SEED) {
    for (const date of days) {
      reports.push(generateReport(cat.id, date))
    }
  }
  return reports
})()
