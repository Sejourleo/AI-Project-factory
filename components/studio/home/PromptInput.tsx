'use client';
import { useEffect, useRef } from 'react';

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export function PromptInput({ value, onChange }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="描述你想创作的内容..."
      className="w-full min-h-[120px] resize-none bg-[var(--color-surface)] text-[var(--color-fg)]
                 font-serif text-xl leading-relaxed px-6 py-5 rounded-2xl
                 placeholder:text-[var(--color-muted)] outline-none
                 focus:ring-1 focus:ring-[var(--color-accent)]"
    />
  );
}
