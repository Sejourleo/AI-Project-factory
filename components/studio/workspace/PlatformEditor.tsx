'use client';
import type { Platform } from '@/lib/studio/types';
import { WechatEditor } from '@/components/studio/editors/WechatEditor';
import { XhsEditor } from '@/components/studio/editors/XhsEditor';
import { TwitterEditor } from '@/components/studio/editors/TwitterEditor';
import { VideoEditor } from '@/components/studio/editors/VideoEditor';

interface Props {
  sessionId: string;
  platform: Platform;
}

export function PlatformEditor({ sessionId, platform }: Props) {
  switch (platform) {
    case 'wechat':  return <WechatEditor sessionId={sessionId} />;
    case 'xhs':     return <XhsEditor sessionId={sessionId} />;
    case 'twitter': return <TwitterEditor sessionId={sessionId} />;
    case 'video':   return <VideoEditor sessionId={sessionId} />;
  }
}
