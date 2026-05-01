import type { GenerateStatus } from '@/lib/studio/types';

const COLOR: Record<NonNullable<GenerateStatus>, string> = {
  pending: 'var(--color-border)',
  streaming: 'var(--color-accent)',
  done: '#4caf7c',
  error: '#e85a5a',
};

export function StatusDot({ status }: { status?: GenerateStatus }) {
  if (!status) return null;
  return (
    <span
      className={'inline-block h-1.5 w-1.5 rounded-full ' + (status === 'streaming' ? 'animate-pulse' : '')}
      style={{ background: COLOR[status] }}
    />
  );
}
