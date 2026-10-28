'use client';

import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, label, children, ...props },
  ref,
) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>}
      <select
        ref={ref}
        className={cn(
          'h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition',
          'focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20',
          'dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100',
          className,
        )}
        {...props}
      >
        {children}
      </select>
    </div>
  );
});
