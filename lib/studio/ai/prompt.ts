import type { Platform, PlatformSettings } from '../types';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface PromptInput {
  platform: Platform;
  input: string;
  settings: PlatformSettings;
}

const HTML_OUTPUT_RULES = `
【输出格式技术约束（必须严格遵守）】
- 直接输出合法 HTML 片段，不要 Markdown 标记
- 不要 \`\`\`html\`\`\` 代码块包裹，不要任何解释性前后文
- 可使用的标签：<h1> <h2> <h3> <p> <strong> <em> <blockquote> <ul> <ol> <li> <hr>
- 段落用 <p>，强调用 <strong>，斜体用 <em>，引用块用 <blockquote><p>...</p></blockquote>
- 不要 <html> <head> <body>，不要内联 style，不要 class
- 文章首行必须是 <h1> 包裹的标题，使用下方"标题模板"填充主题`;

function fillTitle(template: string, topic: string): string {
  return template.includes('{topic}') ? template.replaceAll('{topic}', topic) : template;
}

export function buildMessages(opts: PromptInput): ChatMessage[] {
  const { platform, input, settings } = opts;
  const filledTitle = fillTitle(settings.titleTemplate, input);

  if (platform === 'wechat') {
    const system = `${settings.systemPrompt}\n${HTML_OUTPUT_RULES}`;
    const user = `主题：${input}

标题模板（请用此作为 <h1> 标题）：${filledTitle}

请基于主题创作一篇公众号文章，长度控制在约 ${settings.maxLength} 字符内。`;
    return [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ];
  }

  // 其他平台占位（暂未启用真实 API）
  return [
    { role: 'system', content: settings.systemPrompt },
    { role: 'user', content: `主题：${input}\n标题：${filledTitle}` },
  ];
}
