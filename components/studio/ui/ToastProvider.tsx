'use client';
import { useToastStore } from './Toast';

export function ToastProvider() {
  const items = useToastStore(s => s.items);
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
      {items.map(t => (
        <div
          key={t.id}
          className="px-4 py-3 rounded-lg bg-[var(--color-surface)] text-sm shadow-xl ring-1 ring-[var(--color-border)]"
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
