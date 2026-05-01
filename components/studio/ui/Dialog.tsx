'use client';
import { useEffect, useRef } from 'react';

type DialogSize = 'md' | 'lg' | 'xl';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  size?: DialogSize;
  children: React.ReactNode;
}

const SIZE: Record<DialogSize, string> = {
  md: 'max-w-md',
  lg: 'max-w-xl',
  xl: 'max-w-2xl',
};

export function Dialog({ open, onClose, title, size = 'md', children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={
        `bg-[var(--color-surface)] text-[var(--color-fg)] rounded-xl p-6 ${SIZE[size]} w-[92vw] ` +
        `backdrop:bg-black/40 shadow-2xl ring-1 ring-[var(--color-border)]`
      }
    >
      {title && <h2 className="font-serif text-xl mb-3">{title}</h2>}
      {children}
    </dialog>
  );
}
