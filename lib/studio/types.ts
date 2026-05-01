export type Platform = 'wechat' | 'xhs' | 'twitter' | 'video';

export const ALL_PLATFORMS: Platform[] = ['wechat', 'xhs', 'twitter', 'video'];

export const PLATFORM_LABELS: Record<Platform, string> = {
  wechat: '公众号文章',
  xhs: '小红书笔记',
  twitter: 'Twitter 推文',
  video: '视频脚本',
};

export const PLATFORM_DESCRIPTIONS: Record<Platform, string> = {
  wechat: '深度长文，适合知识分享和观点输出',
  xhs: '生活化短笔记，适合体验和情绪表达',
  twitter: '简短观点或 thread，强钩子',
  video: '分镜脚本，画面与口播分列',
};

export const PLATFORM_EMOJI: Record<Platform, string> = {
  wechat: '📝',
  xhs: '📕',
  twitter: '🐦',
  video: '🎬',
};

export type GenerateStatus = 'pending' | 'streaming' | 'done' | 'error';

export type TwitterMode = 'single' | 'thread';
export type TwitterModeHint = TwitterMode | 'auto';

export interface XhsImage {
  emoji: string;
  desc: string;
}

export interface XhsContent {
  title: string;
  body: string;
  tags: string[];
  images: XhsImage[];
}

export interface ThreadTweet {
  id: string;
  text: string;
}

export interface TwitterContent {
  mode: TwitterMode;
  single: string;
  thread: ThreadTweet[];
}

export interface Scene {
  id: string;
  index: number;
  time: string;       // "00:00-00:15"
  shot: string;
  voice: string;
}

export interface SessionContent {
  wechat?: string;
  xhs?: XhsContent;
  twitter?: TwitterContent;
  video?: Scene[];
}

export interface Session {
  id: string;
  topic: string;
  title?: string;
  platforms: Platform[];
  createdAt: number;
  updatedAt: number;
  content: SessionContent;
  status: Partial<Record<Platform, GenerateStatus>>;
  error?: Partial<Record<Platform, string>>;
  publishResult?: PublishResult;
}

// ─── 公众号发布相关 ────────────────────────────────────────

// type 实际取值除 'subscription' / 'service' 外还有 'subscription_old' 等，留作 string
export type WechatAccountType = string;
export type WechatAccountStatus = 'active' | 'revoked';

export interface WechatAccount {
  name: string;
  wechatAppid: string;
  username: string;
  avatar: string;
  type: WechatAccountType;
  verified: boolean;
  status: WechatAccountStatus;
  lastAuthTime?: string;
  createdAt?: string;
}

export type WechatArticleType = 'news' | 'newspic';

export interface WechatPublishResult {
  publicationId: string;
  materialId: string;
  mediaId: string;
  publishedAt: number;
  appid: string;
  accountName: string;
  articleType: WechatArticleType;
  title: string;
}

export interface PublishResult {
  wechat?: WechatPublishResult;
}

export interface PlatformSettings {
  systemPrompt: string;       // AI 角色 + 风格 + 格式合并后的系统指令
  titleTemplate: string;      // 标题模板，含 {topic} 占位
  maxLength: number;          // 生成内容最大字符数
}

export interface Settings {
  wechat: PlatformSettings;
  xhs: PlatformSettings;
  twitter: PlatformSettings;
  video: PlatformSettings;
}

// AI 接口 chunk 协议（见 spec §5）
export type Chunk =
  | { kind: 'text'; value: string }                       // wechat 用
  | { kind: 'init'; skeleton: unknown; mode?: TwitterMode } // 结构化平台初始化
  | { kind: 'field'; field: string; value: string };      // 结构化平台字段 append
