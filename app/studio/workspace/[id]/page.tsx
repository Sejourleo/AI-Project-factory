'use client';
import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSessionsStore } from '@/lib/studio/store/sessions';
import { Sidebar } from '@/components/studio/workspace/Sidebar';
import { PlatformTabs } from '@/components/studio/workspace/PlatformTabs';
import { WorkspaceActions } from '@/components/studio/workspace/WorkspaceActions';
import { PlatformEditor } from '@/components/studio/workspace/PlatformEditor';
import type { Platform } from '@/lib/studio/types';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function WorkspacePage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const session = useSessionsStore(s => s.sessions[id]);
  const setCurrent = useSessionsStore(s => s.setCurrentId);
  const [active, setActive] = useState<Platform | null>(null);

  useEffect(() => { if (session) setCurrent(id); }, [id, session, setCurrent]);

  useEffect(() => {
    if (session && active && !session.platforms.includes(active)) setActive(null);
    if (session && !active) setActive(session.platforms[0] ?? null);
  }, [session, active]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (!useSessionsStore.getState().sessions[id]) router.push('/studio');
    }, 800);
    return () => clearTimeout(t);
  }, [id, router]);

  return (
    <div className="flex">
      <Sidebar currentId={id} />
      <div className="flex-1 min-w-0 px-8 py-6">
        {session && active ? (
          <div className="space-y-5 max-w-4xl">
            <header className="flex items-start justify-between gap-4">
              <h1 className="font-serif text-2xl truncate">{session.title ?? session.topic}</h1>
              <WorkspaceActions platform={active} session={session} />
            </header>
            <PlatformTabs session={session} active={active} onChange={setActive} />
            <PlatformEditor sessionId={id} platform={active} />
          </div>
        ) : (
          <div className="text-[var(--color-muted)] text-sm">加载会话中…</div>
        )}
      </div>
    </div>
  );
}
