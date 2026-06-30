'use client';
import { Suspense, use, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSessionsStore } from '@/lib/studio/store/sessions';
import { PlatformTabs } from '@/components/studio/workspace/PlatformTabs';
import { WorkspaceActions } from '@/components/studio/workspace/WorkspaceActions';
import { PlatformEditor } from '@/components/studio/workspace/PlatformEditor';
import type { Platform } from '@/lib/studio/types';

interface PageProps {
  params: Promise<{ id: string }>;
}

function WorkspaceContent({ id }: { id: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const session = useSessionsStore(s => s.sessions[id]);
  const setCurrent = useSessionsStore(s => s.setCurrentId);
  const [selectedActive, setSelectedActive] = useState<Platform | null>(null);
  const publishRequested = search.get('publish') === 'wechat';
  const selectedActiveValid =
    !!session && !!selectedActive && session.platforms.includes(selectedActive);
  const requestedActive =
    publishRequested && session?.platforms.includes('wechat') ? 'wechat' : null;
  const active =
    selectedActiveValid ? selectedActive : requestedActive ?? session?.platforms[0] ?? null;

  useEffect(() => { if (session) setCurrent(id); }, [id, session, setCurrent]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (!useSessionsStore.getState().sessions[id]) router.push('/studio');
    }, 800);
    return () => clearTimeout(t);
  }, [id, router]);

  return (
    <div className="px-8 py-6">
      {session && active ? (
        <div className="space-y-5 max-w-4xl">
          <header className="flex items-start justify-between gap-4">
            <h1 className="font-serif text-2xl truncate">{session.title ?? session.topic}</h1>
            <WorkspaceActions
              platform={active}
              session={session}
              autoOpenPublish={publishRequested && active === 'wechat'}
            />
          </header>
          <PlatformTabs session={session} active={active} onChange={setSelectedActive} />
          <PlatformEditor sessionId={id} platform={active} />
        </div>
      ) : (
        <div className="text-[var(--color-muted)] text-sm">加载会话中…</div>
      )}
    </div>
  );
}

export default function WorkspacePage({ params }: PageProps) {
  const { id } = use(params);
  return (
    <Suspense>
      <WorkspaceContent id={id} />
    </Suspense>
  );
}
