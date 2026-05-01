'use client';
import { useEffect, useRef, useState } from 'react';

interface Props {
  value: string;
  onCommit: (next: string) => void;
  onCancel: () => void;
}

export function InlineEdit({ value, onCommit, onCancel }: Props) {
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);

  return (
    <input
      ref={ref}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft.trim() ? onCommit(draft.trim()) : onCancel()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') onCancel();
      }}
      className="w-full bg-[var(--color-surface)] text-sm px-2 py-1 rounded outline-none"
    />
  );
}
