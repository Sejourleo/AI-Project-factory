'use client';
import type {
  WechatAccount,
  WechatArticleType,
  WechatPublishResult,
} from '../types';

export class WechatApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'WechatApiError';
    this.status = status;
    this.code = code;
  }
}

interface AccountsApiSuccess {
  success: true;
  data: { accounts: WechatAccount[]; total: number };
}

interface PublishApiSuccess {
  success: true;
  data: {
    publicationId: string;
    materialId: string;
    mediaId: string;
    status?: string;
    message?: string;
  };
}

async function readError(res: Response): Promise<{ error: string; code?: string }> {
  try {
    const j = await res.json();
    return { error: (j as { error?: string }).error ?? `HTTP ${res.status}`, code: (j as { code?: string }).code };
  } catch {
    return { error: `HTTP ${res.status}` };
  }
}

export async function fetchWechatAccounts(): Promise<WechatAccount[]> {
  const res = await fetch('/api/studio/wechat/accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const { error, code } = await readError(res);
    throw new WechatApiError(error, res.status, code);
  }
  const body = (await res.json()) as AccountsApiSuccess;
  if (!body.success) throw new WechatApiError('账号列表返回异常', res.status);
  return body.data.accounts;
}

export interface PublishWechatInput {
  wechatAppid: string;
  accountName: string;
  title: string;
  content: string;
  summary?: string;
  coverImage?: string;
  author?: string;
  contentFormat: 'markdown' | 'html';
  articleType: WechatArticleType;
}

export async function publishWechat(input: PublishWechatInput): Promise<WechatPublishResult> {
  const res = await fetch('/api/studio/wechat/publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      wechatAppid: input.wechatAppid,
      title: input.title,
      content: input.content,
      summary: input.summary,
      coverImage: input.coverImage,
      author: input.author,
      contentFormat: input.contentFormat,
      articleType: input.articleType,
    }),
  });
  if (!res.ok) {
    const { error, code } = await readError(res);
    throw new WechatApiError(error, res.status, code);
  }
  const body = (await res.json()) as PublishApiSuccess;
  if (!body.success) throw new WechatApiError('发布返回异常', res.status);
  return {
    publicationId: body.data.publicationId,
    materialId: body.data.materialId,
    mediaId: body.data.mediaId,
    publishedAt: Date.now(),
    appid: input.wechatAppid,
    accountName: input.accountName,
    articleType: input.articleType,
    title: input.title,
  };
}
