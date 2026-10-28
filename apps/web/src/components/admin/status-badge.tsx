import { Badge } from '@/components/ui/badge';

type Tone = 'success' | 'danger' | 'neutral' | 'warning' | 'info';

const MAP: Record<string, { label: string; tone: Tone }> = {
  ACTIVE: { label: 'فعال', tone: 'success' },
  SUSPENDED: { label: 'غیرفعال', tone: 'danger' },
  ARCHIVED: { label: 'آرشیو', tone: 'neutral' },
  TRIAL: { label: 'آزمایشی', tone: 'warning' },
  PAST_DUE: { label: 'معوق', tone: 'danger' },
  CANCELED: { label: 'لغو شده', tone: 'neutral' },
  SIGNED: { label: 'امضا شده', tone: 'success' },
};

export function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <Badge tone="neutral">—</Badge>;
  const item = MAP[status] ?? { label: status, tone: 'neutral' as Tone };
  return <Badge tone={item.tone}>{item.label}</Badge>;
}
