// lib/ai/mock-data.ts
import type { Platform, Settings, XhsContent, Scene, TwitterContent } from '../types';

export const defaultSettings: Settings = {
  wechat: {
    systemPrompt: `你是一位资深的公众号内容创作者，擅长撰写深度、专业的长文章。

写作风格要求：
- 结构清晰，包含引言、核心观点（3-5 个要点）、总结
- 语言专业但不晦涩，适合大众阅读
- 每个段落要有实质性内容，避免空泛
- 适当使用案例和数据支撑观点
- 关键句子用 <strong> 加粗，金句用 <blockquote> 引用块
- 章节之间可用 <hr> 分隔`,
    titleTemplate: '深度解析：{topic}',
    maxLength: 10000,
  },
  xhs: {
    systemPrompt: `你是一位深谙小红书调性的内容创作者，擅长写出让人想看完、想点赞、想收藏的笔记。

写作风格要求：
- 亲切口语化，强调真实体验和情绪共鸣
- 适度使用 emoji 装饰，避免堆砌
- 分段紧凑，每段聚焦一个小点
- 结尾有互动钩子或行动号召`,
    titleTemplate: '🌸 关于「{topic}」的真实分享',
    maxLength: 800,
  },
  twitter: {
    systemPrompt: `你是一位英中双语的 Twitter 高产作者，擅长把复杂观点压成 280 字以内的钩子，或写成层层推进的 thread。

写作风格要求：
- 每条推文独立成立，能被单独引用
- Thread 模式下首条要有强钩子，末条总结或行动号召
- 简洁有观点，避免水分
- 适度使用编号、表情、换行强化节奏`,
    titleTemplate: '关于「{topic}」',
    maxLength: 2800,
  },
  video: {
    systemPrompt: `你是一位短视频脚本编剧，擅长把一个想法拆成可拍摄的分镜。

写作风格要求：
- 画面描述具体到构图、动作、氛围、镜头语言
- 旁白口语化、节奏紧凑、句子短
- 总时长 30-90 秒，每个分镜 5-15 秒
- 开头 3 秒内必须抓住注意力`,
    titleTemplate: '{topic} | 短视频脚本',
    maxLength: 2000,
  },
};

// 公众号 mock：返回完整 HTML
export function mockWechatHtml(input: string): string {
  return `
<h2>引言</h2>
<p>关于"${input}"，许多人有过类似的困惑。本文尝试从三个维度展开探讨，希望能带来一些新的视角。</p>
<h2>一、问题的本质</h2>
<p>表面看，这是一个执行层面的问题。但<strong>深入观察后会发现</strong>，根源往往藏在认知层面。</p>
<blockquote><p>真正的瓶颈不是没时间，而是没意识到自己在做的事情其实没那么重要。</p></blockquote>
<p>这句话适用于绝大多数现代人面对的困境。</p>
<hr>
<h2>二、可行的破局路径</h2>
<p>对应上述问题，我尝试过三种不同的策略：</p>
<p>第一是<em>结构化拆解</em>。把模糊的目标拆成具体动作，再按周排进日历。</p>
<p>第二是<strong>定期复盘</strong>。每周末花 30 分钟回看本周做的事，标记哪些产生了价值。</p>
<p>第三是<em>主动留白</em>。给自己留出不被填满的时间块，让思考有发酵空间。</p>
<h2>三、一些不那么显然的副作用</h2>
<p>这些方法不是免费的。结构化会牺牲灵活性；复盘容易陷入自责；留白可能被外部需求蚕食。</p>
<p>但权衡下来，<strong>它们带来的清晰度仍然值得</strong>。</p>
<h2>结语</h2>
<p>关于"${input}"的探索没有标准答案。希望本文提供的视角，能成为你思考路径上的一块砖。</p>
`.trim();
}

// 小红书 mock：返回结构化数据
export function mockXhsContent(input: string): XhsContent {
  return {
    title: `🌸 关于「${input}」的真实分享`,
    body: `姐妹们！最近在认真想"${input}"这件事，必须跟大家聊聊我的真实感受。\n\n💡 第一个发现\n之前一直以为这件事没那么重要，直到亲自试了才发现完全不是想象的那样。\n\n💡 第二个发现\n关键不在方法，而在心态。当我开始接受不完美的进度，反而做得更稳了。\n\n💡 我的小建议\n如果你也在纠结，不妨先迈出最小的一步。哪怕只是 5 分钟。\n\n你们怎么看呀？评论区一起聊！`,
    tags: ['真实分享', '生活感悟', '成长记录', '日常思考'],
    images: [
      { emoji: '🌅', desc: '清晨窗边的咖啡杯，自然光从左侧打入，桌面有打开的笔记本' },
      { emoji: '✍️', desc: '俯拍视角，手写笔记特写，纸张有自然褶皱' },
      { emoji: '🪴', desc: '书桌一角，绿植与书本组合，暖色调氛围' },
    ],
  };
}

// Twitter mock：根据 mode 返回单条或 thread
export function mockTwitterContent(input: string, mode: 'single' | 'thread'): TwitterContent {
  if (mode === 'single') {
    return {
      mode: 'single',
      single: `关于"${input}"，今天突然想明白一件事：当你停止追求完美开始追求完成，效率会突然上一个台阶。但前提是你能接受 80 分的成果先发出去。`,
      thread: [],
    };
  }
  return {
    mode: 'thread',
    single: '',
    thread: [
      { id: 't1', text: `线索：关于"${input}"，过去三个月我换过四种方法。今天分享一下哪个真正有效。👇` },
      { id: 't2', text: '1/ 最早试过纯计划党。每天提前列 10 个待办。结果：完成率 < 40%，而且越列越焦虑。问题：把估计当作了承诺。' },
      { id: 't3', text: '2/ 然后试了完全的 reactive 模式。哪个最重要做哪个。结果：紧急的事情吞噬了重要的事情。' },
      { id: 't4', text: '3/ 第三种是时间块。把一天切成 3 个 90 分钟。听起来很美，实际很难抗住打扰。' },
      { id: 't5', text: '4/ 现在的方法很反直觉：每天只承诺一件事。其他都是 bonus。完成率反而 > 90%，而且做的都是真正重要的。' },
      { id: 't6', text: '关键转变不是方法，是心态——从"做更多"切换到"做更少但做对"。慢，但累积起来反而快。' },
    ],
  };
}

// 视频脚本 mock：返回 Scene[]
export function mockVideoScenes(input: string): Scene[] {
  return [
    {
      id: 'sc1',
      index: 1,
      time: '00:00-00:05',
      shot: '快速推镜头，主角伏案工作的特写，画面略显凌乱',
      voice: `你也常常觉得"${input}"这件事很难吗？`,
    },
    {
      id: 'sc2',
      index: 2,
      time: '00:05-00:20',
      shot: '中景切换为分屏：左侧时钟快进，右侧待办清单逐项打勾但永远写不完',
      voice: '我们以为答案是更多时间、更多技巧。但真正的问题往往在更前面一步。',
    },
    {
      id: 'sc3',
      index: 3,
      time: '00:20-00:40',
      shot: '主角靠在椅背上深呼吸的中近景，光线变柔，背景虚化',
      voice: '当你愿意停下来 5 分钟，问自己——"今天最重要的一件事是什么？"很多复杂会瞬间消失。',
    },
    {
      id: 'sc4',
      index: 4,
      time: '00:40-00:55',
      shot: '俯拍笔记本特写，手写下一行字，镜头缓慢拉远',
      voice: '把它写下来。然后，先做这一件。',
    },
    {
      id: 'sc5',
      index: 5,
      time: '00:55-01:00',
      shot: '主角抬头微笑的特写，画面定格，浮现品牌 logo',
      voice: '少做一点，做对一点。',
    },
  ];
}

export function mockTextLength(platform: Platform, input: string): number {
  // 用于 Twitter "auto" 判定时估算长度
  if (platform === 'twitter') {
    return input.length > 30 ? 600 : 200;  // 简化：输入越长越倾向于 thread
  }
  return 0;
}
