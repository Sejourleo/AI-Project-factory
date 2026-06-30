'use client';
import { useSessionsStore } from '@/lib/studio/store/sessions';
import { Sidebar } from '@/components/studio/workspace/Sidebar';

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  const currentId = useSessionsStore(s => s.currentId);
  return (
    <div className="studio-scope min-h-screen flex">
      <Sidebar currentId={currentId} />
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  );
}
