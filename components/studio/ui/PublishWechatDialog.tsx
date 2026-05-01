'use client';
import { useEffect, useMemo, useState } from 'react';
import { Dialog } from './Dialog';
import { Button } from './Button';
import { toast } from './Toast';
import {
  fetchWechatAccounts,
  publishWechat,
  WechatApiError,
  type PublishWechatInput,
} from '@/lib/studio/api/wechatPublish';
import { extractWechatTitle, countWechatImages, htmlToNewspicMarkdown } from '@/lib/studio/wechat';
import type { WechatAccount, WechatArticleType, WechatPublishResult } from '@/lib/studio/types';

interface Props {
  open: boolean;
  onClose: () => void;
  sessionTopic: string;
  sessionTitle?: string;
  html: string;
  onPublished: (result: WechatPublishResult) => void;
}

const NEWSPIC_MAX = 1000;
const TITLE_MAX = 64;
const SUMMARY_MAX = 120;

export function PublishWechatDialog({
  open,
  onClose,
  sessionTopic,
  sessionTitle,
  html,
  onPublished,
}: Props) {
  const [accountsState, setAccountsState] = useState<
    | { phase: 'idle' }
    | { phase: 'loading' }
    | { phase: 'error'; message: string }
    | { phase: 'ready'; accounts: WechatAccount[] }
  >({ phase: 'idle' });

  const [selectedAppid, setSelectedAppid] = useState<string>('');
  const [articleType, setArticleType] = useState<WechatArticleType>('news');
  const [title, setTitle] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [summary, setSummary] = useState('');
  const [author, setAuthor] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const imageCount = useMemo(() => countWechatImages(html), [html]);
  const newspicAvailable = imageCount > 0;

  // 模态打开时初始化
  useEffect(() => {
    if (!open) return;
    setError(null);
    setSubmitting(false);
    setShowAdvanced(false);
    setSummary('');
    setAuthor('');
    setCoverImage('');
    setArticleType('news');
    setTitle(extractWechatTitle(html) || sessionTitle || sessionTopic);
    setAccountsState({ phase: 'loading' });

    let cancelled = false;
    fetchWechatAccounts()
      .then((accounts) => {
        if (cancelled) return;
        setAccountsState({ phase: 'ready', accounts });
        const first = accounts.find((a) => a.status === 'active') ?? accounts[0];
        if (first) setSelectedAppid(first.wechatAppid);
      })
      .catch((e) => {
        if (cancelled) return;
        const msg = e instanceof WechatApiError ? e.message : (e instanceof Error ? e.message : String(e));
        setAccountsState({ phase: 'error', message: msg });
      });

    return () => { cancelled = true; };
  }, [open, html, sessionTitle, sessionTopic]);

  // 切到 newspic 但当前不可用时，自动回退到 news
  useEffect(() => {
    if (articleType === 'newspic' && !newspicAvailable) {
      setArticleType('news');
    }
  }, [articleType, newspicAvailable]);

  const titleLen = title.length;
  const titleOver = titleLen > TITLE_MAX;
  const summaryOver = summary.length > SUMMARY_MAX;

  const canSubmit =
    !submitting &&
    accountsState.phase === 'ready' &&
    !!selectedAppid &&
    title.trim().length > 0 &&
    !titleOver &&
    !summaryOver;

  async function handlePublish() {
    if (!canSubmit) return;
    if (accountsState.phase !== 'ready') return;
    const account = accountsState.accounts.find((a) => a.wechatAppid === selectedAppid);
    if (!account) return;

    setSubmitting(true);
    setError(null);
    try {
      const input: PublishWechatInput = (() => {
        if (articleType === 'newspic') {
          const { content } = htmlToNewspicMarkdown(html, NEWSPIC_MAX);
          return {
            wechatAppid: selectedAppid,
            accountName: account.name,
            title: title.trim(),
            content,
            summary: summary.trim() || undefined,
            coverImage: coverImage.trim() || undefined,
            author: author.trim() || undefined,
            contentFormat: 'markdown',
            articleType: 'newspic',
          };
        }
        return {
          wechatAppid: selectedAppid,
          accountName: account.name,
          title: title.trim(),
          content: html,
          summary: summary.trim() || undefined,
          coverImage: coverImage.trim() || undefined,
          author: author.trim() || undefined,
          contentFormat: 'html',
          articleType: 'news',
        };
      })();
      const result = await publishWechat(input);
      onPublished(result);
      toast(`已发布到「${account.name}」草稿箱`);
      onClose();
    } catch (e) {
      const msg = e instanceof WechatApiError ? e.message : (e instanceof Error ? e.message : String(e));
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  function retryAccounts() {
    setAccountsState({ phase: 'loading' });
    fetchWechatAccounts()
      .then((accounts) => {
        setAccountsState({ phase: 'ready', accounts });
        const first = accounts.find((a) => a.status === 'active') ?? accounts[0];
        if (first) setSelectedAppid(first.wechatAppid);
      })
      .catch((e) => {
        const msg = e instanceof WechatApiError ? e.message : (e instanceof Error ? e.message : String(e));
        setAccountsState({ phase: 'error', message: msg });
      });
  }

  const selectedAccountName = useMemo(() => {
    if (accountsState.phase !== 'ready') return '';
    return accountsState.accounts.find((a) => a.wechatAppid === selectedAppid)?.name ?? '';
  }, [accountsState, selectedAppid]);

  return (
    <Dialog open={open} onClose={onClose} title="发布到公众号" size="xl">
      <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1 -mr-1">
        {/* 账号选择 */}
        <section className="space-y-2">
          <h3 className="text-sm font-medium">选择公众号</h3>
          {accountsState.phase === 'loading' && (
            <div className="grid grid-cols-2 gap-2">
              {[0, 1].map((i) => (
                <div key={i} className="h-16 rounded-lg bg-[var(--color-elevated)] animate-pulse" />
              ))}
            </div>
          )}
          {accountsState.phase === 'error' && (
            <div className="rounded-lg bg-[#fef2f2] ring-1 ring-[#fecaca] p-3 text-sm text-[#991b1b] flex items-center justify-between gap-3">
              <span>账号列表加载失败：{accountsState.message}</span>
              <Button variant="ghost" size="sm" onClick={retryAccounts}>重试</Button>
            </div>
          )}
          {accountsState.phase === 'ready' && accountsState.accounts.length === 0 && (
            <div className="rounded-lg bg-[var(--color-elevated)] p-4 text-sm text-[var(--color-muted)]">
              暂无授权公众号，请先在 limyai 后台完成授权。
            </div>
          )}
          {accountsState.phase === 'ready' && accountsState.accounts.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {accountsState.accounts.map((acc) => {
                const active = acc.wechatAppid === selectedAppid;
                const disabled = acc.status !== 'active';
                return (
                  <button
                    key={acc.wechatAppid}
                    type="button"
                    disabled={disabled}
                    onClick={() => setSelectedAppid(acc.wechatAppid)}
                    className={
                      'flex items-center gap-3 rounded-lg p-3 text-left transition-all ' +
                      (active
                        ? 'bg-[var(--color-surface)] ring-1 ring-[var(--color-accent)] shadow-[0_0_0_3px_var(--color-accent-soft)]'
                        : 'bg-[var(--color-elevated)] hover:bg-[var(--color-surface)] ring-1 ring-transparent') +
                      (disabled ? ' opacity-50 cursor-not-allowed' : '')
                    }
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={acc.avatar}
                      alt=""
                      className="h-10 w-10 rounded-md object-cover bg-[var(--color-elevated)]"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{acc.name}</div>
                      <div className="text-[11px] text-[var(--color-muted)] flex items-center gap-1.5 mt-0.5">
                        <span>{accountTypeLabel(acc.type)}</span>
                        {acc.verified && <span className="text-[var(--color-platform-wechat)]">·已认证</span>}
                        {acc.status === 'revoked' && <span className="text-[#dc2626]">·已解绑</span>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* 类型选择 */}
        <section className="space-y-2">
          <h3 className="text-sm font-medium">发布类型</h3>
          <div className="grid grid-cols-2 gap-2">
            <TypeOption
              active={articleType === 'news'}
              disabled={false}
              label="公众号文章"
              description="保留 HTML 格式，长文首选"
              onClick={() => setArticleType('news')}
            />
            <TypeOption
              active={articleType === 'newspic'}
              disabled={!newspicAvailable}
              label="小绿书（图文）"
              description={newspicAvailable
                ? `已检出 ${imageCount} 张图，纯文本 ≤ ${NEWSPIC_MAX} 字`
                : '需在编辑器至少插入 1 张带 URL 的图片'}
              onClick={() => newspicAvailable && setArticleType('newspic')}
            />
          </div>
        </section>

        {/* 标题 */}
        <section className="space-y-1.5">
          <label className="text-sm font-medium flex items-center justify-between">
            <span>文章标题 <span className="text-[#dc2626]">*</span></span>
            <span className={'text-[11px] font-mono ' + (titleOver ? 'text-[#dc2626]' : 'text-[var(--color-muted)]')}>
              {titleLen}/{TITLE_MAX}
            </span>
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="文章标题（默认从 H1 提取）"
            className="w-full h-10 px-3 rounded-md bg-[var(--color-elevated)] text-sm outline-none
                       focus:ring-1 focus:ring-[var(--color-accent)]"
          />
        </section>

        {/* 高级选项（折叠） */}
        <section className="space-y-2">
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)] inline-flex items-center gap-1"
          >
            <span>{showAdvanced ? '▾' : '▸'}</span>
            高级选项（摘要 / 作者 / 封面图）
          </button>
          {showAdvanced && (
            <div className="space-y-3 rounded-lg bg-[var(--color-elevated)]/60 p-3">
              <div className="space-y-1.5">
                <label className="text-xs flex items-center justify-between">
                  <span>摘要（≤ {SUMMARY_MAX}）</span>
                  <span className={'text-[11px] font-mono ' + (summaryOver ? 'text-[#dc2626]' : 'text-[var(--color-muted)]')}>
                    {summary.length}/{SUMMARY_MAX}
                  </span>
                </label>
                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  rows={2}
                  placeholder="不填则微信自动从内容提取"
                  className="w-full rounded-md bg-[var(--color-surface)] text-sm p-2 leading-6 outline-none resize-none
                             focus:ring-1 focus:ring-[var(--color-accent)]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs">作者</label>
                  <input
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-md bg-[var(--color-surface)] text-sm outline-none
                               focus:ring-1 focus:ring-[var(--color-accent)]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs">封面图 URL</label>
                  <input
                    value={coverImage}
                    onChange={(e) => setCoverImage(e.target.value)}
                    placeholder="不填则自动从内容提取首张图"
                    className="w-full h-9 px-2.5 rounded-md bg-[var(--color-surface)] text-xs font-mono outline-none
                               focus:ring-1 focus:ring-[var(--color-accent)]"
                  />
                </div>
              </div>
            </div>
          )}
        </section>

        {error && (
          <div className="rounded-lg bg-[#fef2f2] ring-1 ring-[#fecaca] p-3 text-sm text-[#991b1b]">
            发布失败：{error}
          </div>
        )}
      </div>

      {/* 底部操作栏 */}
      <div className="flex items-center justify-between gap-3 pt-5 mt-3 border-t border-[var(--color-border)]">
        <div className="text-xs text-[var(--color-muted)] truncate">
          {selectedAccountName && (
            <>
              已选「{selectedAccountName}」·{articleType === 'news' ? '公众号文章' : '小绿书'}
            </>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>取消</Button>
          <Button size="sm" onClick={handlePublish} disabled={!canSubmit}>
            {submitting ? '发布中…' : '发布'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function TypeOption({
  active,
  disabled,
  label,
  description,
  onClick,
}: {
  active: boolean;
  disabled: boolean;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={
        'rounded-lg p-3 text-left transition-all ' +
        (active
          ? 'bg-[var(--color-surface)] ring-1 ring-[var(--color-accent)] shadow-[0_0_0_3px_var(--color-accent-soft)]'
          : 'bg-[var(--color-elevated)] hover:bg-[var(--color-surface)] ring-1 ring-transparent') +
        (disabled ? ' opacity-50 cursor-not-allowed' : '')
      }
    >
      <div className="text-sm font-medium">{label}</div>
      <div className="text-[11px] text-[var(--color-muted)] mt-0.5 leading-relaxed">
        {description}
      </div>
    </button>
  );
}

function accountTypeLabel(t: string): string {
  if (t === 'subscription' || t === 'subscription_old') return '订阅号';
  if (t === 'service') return '服务号';
  return t;
}
