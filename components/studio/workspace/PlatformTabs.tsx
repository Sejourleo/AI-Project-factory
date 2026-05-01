'use client';
import { PLATFORM_LABELS } from '@/lib/studio/types';
import type { Platform, Session } from '@/lib/studio/types';
import { StatusDot } from './GenerateStatus';

interface Props {
  session: Session;
  active: Platform;
  onChange: (p: Platform) => void;
}

export function PlatformTabs({ session, active, onChange }: Props) {
  return (
    <div className="flex border-b border-[var(--color-border)]">
      {session.platforms.map(p => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={
            'flex items-center gap-2 px-4 py-3 text-sm transition-colors relative ' +
            (active === p
              ? 'text-[var(--color-fg)]'
              : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]')
          }
        >
          <StatusDot status={session.status[p]} />
          {PLATFORM_LABELS[p]}
          {active === p && (
            <span
              className="absolute bottom-0 inset-x-0 h-px"
              style={{ background: 'var(--color-accent)' }}
            />
          )}
        </button>
      ))}
    </div>
  );
}
