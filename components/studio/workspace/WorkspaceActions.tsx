'use client';
import { useState } from 'react';
import { Button } from '@/components/studio/ui/Button';
import { toast } from '@/components/studio/ui/Toast';
import { PublishWechatDialog } from '@/components/studio/ui/PublishWechatDialog';
import { useSessionsStore } from '@/lib/studio/store/sessions';
import type { Platform, Session } from '@/lib/studio/types';

interface Props {
  platform: Platform;
  session: Session;
  autoOpenPublish?: boolean;
}

const SHOW_PUBLISH: Record<Platform, boolean> = {
  wechat: true,
  xhs: true,
  twitter: true,
  video: false,
};

async function copyForPlatform(platform: Platform, session: Session) {
  const c = session.content;
  try {
    if (platform === 'wechat' && c.wechat) {
      const html = c.wechat;
      const cb = navigator.clipboard as Clipboard & { write?: Clipboard['write'] };
      if (typeof cb.write === 'function') {
        await cb.write([
          new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([html.replace(/<[^>]+>/g, '')], { type: 'text/plain' }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(html);
      }
    } else if (platform === 'xhs' && c.xhs) {
      const text = `${c.xhs.title}\n\n${c.xhs.body}\n\n${c.xhs.tags.map(t => '#' + t).join(' ')}`;
      await navigator.clipboard.writeText(text);
    } else if (platform === 'twitter' && c.twitter) {
      const text = c.twitter.mode === 'single'
        ? c.twitter.single
        : c.twitter.thread.map(t => t.text).join('\n\n');
      await navigator.clipboard.writeText(text);
    } else if (platform === 'video' && c.video) {
      const text = c.video.map(s => `# ${s.index} (${s.time})\n画面：${s.shot}\n旁白：${s.voice}`).join('\n\n');
      await navigator.clipboard.writeText(text);
    }
    toast('已复制');
  } catch {
    toast('复制失败');
  }
}

export function WorkspaceActions({ platform, session, autoOpenPublish = false }: Props) {
  const setWechatPublishResult = useSessionsStore(s => s.setWechatPublishResult);
  const [wechatDialogOpen, setWechatDialogOpen] = useState(false);
  const [autoPublishDismissed, setAutoPublishDismissed] = useState(false);

  const wechatHtml = session.content.wechat ?? '';
  const wechatPublished = session.publishResult?.wechat;
  const canPublishWechat = !!wechatHtml.trim();
  const shouldAutoOpenPublish =
    autoOpenPublish &&
    !autoPublishDismissed &&
    platform === 'wechat' &&
    session.status.wechat === 'done' &&
    canPublishWechat;
  const publishDialogOpen = wechatDialogOpen || shouldAutoOpenPublish;

  function openWechatDialog() {
    setAutoPublishDismissed(false);
    setWechatDialogOpen(true);
  }

  function closeWechatDialog() {
    setAutoPublishDismissed(true);
    setWechatDialogOpen(false);
  }

  function renderPublishButton() {
    if (platform === 'wechat') {
      const label = wechatPublished ? '再次发布' : '发布到公众号';
      return (
        <Button
          variant="primary"
          size="sm"
          onClick={openWechatDialog}
          disabled={!canPublishWechat}
          title={canPublishWechat ? '打开公众号发布弹窗' : '内容尚未生成完成'}
        >
          {label}
        </Button>
      );
    }
    return (
      <Button variant="primary" size="sm" onClick={() => toast('发布成功')}>发布</Button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => copyForPlatform(platform, session)}>复制</Button>
        {SHOW_PUBLISH[platform] && renderPublishButton()}
      </div>
      {platform === 'wechat' && wechatPublished && (
        <span className="text-[11px] text-[var(--color-muted)]">
          已发布到「{wechatPublished.accountName}」草稿箱 · {new Date(wechatPublished.publishedAt).toLocaleString('zh-CN', { hour12: false })}
        </span>
      )}

      {platform === 'wechat' && (
        <PublishWechatDialog
          open={publishDialogOpen}
          onClose={closeWechatDialog}
          sessionTopic={session.topic}
          sessionTitle={session.title}
          html={wechatHtml}
          onPublished={(result) => setWechatPublishResult(session.id, result)}
        />
      )}
    </div>
  );
}
