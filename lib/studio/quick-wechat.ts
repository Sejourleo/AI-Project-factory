import type { ContentItem, TopicInsight } from '@/lib/types'

export function studioWechatDraftHref(prompt: string, publish = true): string {
  const qs = new URLSearchParams({
    prompt,
    platforms: 'wechat',
    auto: '1',
  })
  if (publish) qs.set('publish', 'wechat')
  return `/studio?${qs.toString()}`
}

export function contentToWechatPrompt(item: ContentItem): string {
  return [
    '请基于下面这条热点素材，写一篇可直接放入微信公众号草稿箱的深度文章。',
    '',
    `标题：${item.title}`,
    `平台：${item.platform}`,
    `作者/来源：${item.author}`,
    `摘要：${item.summary}`,
    `热度：${item.hotScore}`,
    item.tags.length > 0 ? `标签：${item.tags.join('、')}` : '',
    `原文链接：${item.url}`,
    '',
    '要求：保留事实边界，不虚构数据；给出清晰观点、结构化小标题、开头钩子和结尾行动建议；输出适合公众号编辑器的 HTML。',
  ].filter(Boolean).join('\n')
}

export function insightToWechatPrompt(insight: TopicInsight): string {
  return [
    '请基于下面这条选题洞察，写一篇可直接放入微信公众号草稿箱的深度文章。',
    '',
    `选题：${insight.title}`,
    `切入点：${insight.angle}`,
    `目标受众：${insight.audience}`,
    `形式建议：${insight.contentFormat}`,
    `差异化突破点：${insight.differentiation}`,
    insight.tags.length > 0 ? `标签：${insight.tags.join('、')}` : '',
    insight.evidenceNoteIds.length > 0 ? `参考素材 ID：${insight.evidenceNoteIds.join('、')}` : '',
    '',
    '要求：把选题扩展成完整公众号文章，开头要有明确钩子，中段给出可验证的论据与方法，结尾给读者一个可执行动作；输出适合公众号编辑器的 HTML。',
  ].filter(Boolean).join('\n')
}
