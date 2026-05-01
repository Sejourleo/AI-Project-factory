import { ButtonHTMLAttributes, forwardRef } from 'react';

type Variant = 'primary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent)]/90',
  ghost: 'bg-transparent text-[var(--color-fg)] hover:bg-[var(--color-surface)]',
  danger: 'bg-transparent text-[#e85a5a] hover:bg-[#e85a5a]/10',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-5 text-sm',
  lg: 'h-12 px-7 text-base',
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', size = 'md', className = '', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={
        'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors ' +
        'disabled:opacity-40 disabled:pointer-events-none ' +
        `${VARIANTS[variant]} ${SIZES[size]} ${className}`
      }
      {...rest}
    />
  );
});
