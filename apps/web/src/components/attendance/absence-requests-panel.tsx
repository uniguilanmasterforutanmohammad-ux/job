'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { endUserNoun } from '@repo/shared';
import { api, ApiClientError } from '@/lib/api-client';
import { getAccessToken, useAuth } from '@/lib/auth';
import { formatJalali } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { EmptyState, Skeleton } from '@/components/ui/empty-state';
import type { AbsenceRequest } from '@/lib/types-extra';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'در انتظار بررسی',
  APPROVED: 'تأییدشده (موجه)',
  REJECTED: 'ردشده',
  CANCELED: 'لغوشده',
};

const STATUS_TONES: Record<string, 'warning' | 'success' | 'danger' | 'neutral'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  CANCELED: 'neutral',
};

export function AbsenceRequestsPanel() {
  const token = getAccessToken();
  const { me } = useAuth();
  // A sports club says «شاگرد», a clinic «بیمار», a law office «موکل» …
  const noun = endUserNoun(me?.tenant.industry);
  const nounPlural = endUserNoun(me?.tenant.industry, true);
  const queryClient = useQueryClient();
  const [reviewing, setReviewing] = useState<AbsenceRequest | null>(null);
  const [decision, setDecision] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [reviewNote, setReviewNote] = useState('');

  const requestsQuery = useQuery({
    queryKey: ['absence-requests'],
    queryFn: () => api.get<AbsenceRequest[]>('/attendance/absence-requests', token),
  });

  const review = useMutation({
    mutationFn: () =>
      api.patch(
        `/attendance/absence-requests/${reviewing?.id}/review`,
        { decision, reviewNote: reviewNote.trim() || undefined },
        token,
      ),
    onSuccess: () => {
      toast.success(decision === 'APPROVED' ? 'درخواست تأیید شد' : 'درخواست رد شد');
      setReviewing(null);
      setReviewNote('');
      void queryClient.invalidateQueries({ queryKey: ['absence-requests'] });
      void queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
    onError: (e) => toast.error(e instanceof ApiClientError ? e.message : 'خطا در بررسی درخواست'),
  });

  const requests = requestsQuery.data ?? [];
  const pending = requests.filter((r) => r.status === 'PENDING').length;

  return (
    <Card>
      <CardHeader
        title="درخواست‌های غیبت موجه"
        description={`درخواست‌های ${nounPlural} برای موجه کردن عدم حضور`}
        action={pending > 0 ? <Badge tone="warning">{pending} در انتظار</Badge> : undefined}
      />
      <CardBody className="space-y-2">
        {requestsQuery.isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : requests.length === 0 ? (
          <EmptyState icon={Clock} title="درخواستی ثبت نشده است" />
        ) : (
          requests.map((request) => (
            <div
              key={request.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-3 dark:border-slate-800"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {request.customer?.fullName ?? noun}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  <span className="nums">{formatJalali(request.absenceDate)}</span> —{' '}
                  {request.reason}
                  {request.note ? ` (${request.note})` : ''}
                </p>
                {request.reviewNote && (
                  <p className="mt-1 text-xs text-slate-400">یادداشت بررسی: {request.reviewNote}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={STATUS_TONES[request.status] ?? 'neutral'}>
                  {STATUS_LABELS[request.status] ?? request.status}
                </Badge>
                {request.status === 'PENDING' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setReviewing(request);
                      setDecision('APPROVED');
                      setReviewNote('');
                    }}
                  >
                    بررسی
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </CardBody>

      <Modal
        open={Boolean(reviewing)}
        onClose={() => setReviewing(null)}
        title="بررسی درخواست غیبت"
        footer={
          <>
            <Button variant="ghost" onClick={() => setReviewing(null)}>
              انصراف
            </Button>
            <Button
              variant={decision === 'APPROVED' ? 'primary' : 'danger'}
              loading={review.isPending}
              onClick={() => review.mutate()}
            >
              {decision === 'APPROVED' ? 'تأیید (موجه)' : 'رد درخواست'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/50">
            <p className="font-medium">{reviewing?.customer?.fullName ?? noun}</p>
            <p className="mt-1 text-xs text-slate-500 nums">
              {reviewing ? formatJalali(reviewing.absenceDate) : ''} — {reviewing?.reason}
            </p>
            {reviewing?.note && <p className="mt-1 text-xs text-slate-400">{reviewing.note}</p>}
          </div>

          <div className="flex gap-2">
            <Button
              variant={decision === 'APPROVED' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setDecision('APPROVED')}
            >
              <CheckCircle2 className="h-4 w-4" />
              تأیید (غیبت موجه ثبت شود)
            </Button>
            <Button
              variant={decision === 'REJECTED' ? 'danger' : 'outline'}
              size="sm"
              onClick={() => setDecision('REJECTED')}
            >
              <XCircle className="h-4 w-4" />
              رد
            </Button>
          </div>

          <Input
            label={`توضیح برای ${noun} (اختیاری)`}
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
          />
        </div>
      </Modal>
    </Card>
  );
}
