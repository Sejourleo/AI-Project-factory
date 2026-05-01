import { ButtonHTMLAttributes, forwardRef } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;  // a11y
}

export const IconButton = forwardRef<HTMLButtonElement, Props>(function IconButton(
  { className = '', label, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      aria-label={label}
      title={label}
      className={
        'inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-muted)] ' +
        'hover:bg-[var(--color-surface)] hover:text-[var(--color-fg)] transition-colors ' +
        className
      }
      {...rest}
    >
      {children}
    </button>
  );
});
