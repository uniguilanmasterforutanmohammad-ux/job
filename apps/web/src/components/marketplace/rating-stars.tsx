import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Compact 1–5 star display (server-component friendly). */
export function RatingStars({
  value,
  size = 'sm',
  className,
}: {
  value: number;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const dimension = size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5';
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)} dir="ltr">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = value >= star - 0.25;
        return (
          <Star
            key={star}
            className={cn(
              dimension,
              filled ? 'fill-amber-400 text-amber-400' : 'fill-transparent text-slate-300',
            )}
          />
        );
      })}
    </span>
  );
}
