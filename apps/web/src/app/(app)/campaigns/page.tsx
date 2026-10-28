'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Heart, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiClientError } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth';
import { formatJalali, formatNumber, formatToman } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState, Skeleton } from '@/components/ui/empty-state';
import { CAMPAIGN_STATUS_LABELS, CAMPAIGN_STATUS_TONES } from '@/lib/status';
import type { Campaign } from '@/lib/types';

export default function CampaignsPage() {
  const token = getAccessToken();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', targetAmount: '', minAmount: '' });

  const campaignsQuery = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => api.get<Campaign[]>('/campaigns', token),
  });

  const createCampaign = useMutation({
    mutationFn: () =>
      api.post(
        '/campaigns',
        {
          title: form.title,
          description: form.description || undefined,
          targetAmount: Number(form.targetAmount) || 0,
          minAmount: Number(form.minAmount) || 0,
        },
        token,
      ),
    onSuccess: () => {
      toast.success('کمپین ایجاد شد');
      setOpen(false);
      setForm({ title: '', description: '', targetAmount: '', minAmount: '' });
      void queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : 'خطا در ایجاد کمپین'),
  });

  const activate = useMutation({
    mutationFn: (id: string) => api.post(`/campaigns/${id}/activate`, {}, token),
    onSuccess: () => {
      toast.success('کمپین فعال شد');
      void queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="کمپین و جمع‌آوری وجه"
        description="کمپین کمک، پیشرفت هدف، شفافیت هزینه و رسید"
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            کمپین جدید
          </Button>
        }
      />

      {campaignsQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : campaignsQuery.data && campaignsQuery.data.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {campaignsQuery.data.map((campaign) => {
            const collected = Number(campaign.collected);
            const target = Number(campaign.targetAmount);
            const percent = target > 0 ? Math.min(100, Math.round((collected / target) * 100)) : 0;
            return (
              <Card key={campaign.id}>
                <CardBody className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">{campaign.title}</h3>
                    <Badge tone={CAMPAIGN_STATUS_TONES[campaign.status]}>
                      {CAMPAIGN_STATUS_LABELS[campaign.status]}
                    </Badge>
                  </div>
                  {campaign.description && (
                    <p className="line-clamp-2 text-sm text-slate-500">{campaign.description}</p>
                  )}
                  <div>
                    <div className="mb-1 flex justify-between text-xs text-slate-500">
                      <span className="nums">{formatToman(collected)}</span>
                      <span className="nums">از {formatToman(target)}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className="h-full rounded-full bg-brand-500" style={{ width: `${percent}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-slate-400 nums">
                      {formatNumber(percent)}٪ · {formatNumber(campaign._count?.contributions ?? 0)} مشارکت
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 nums">{formatJalali(campaign.deadline)}</span>
                    {campaign.status === 'DRAFT' && (
                      <Button size="sm" onClick={() => activate.mutate(campaign.id)}>
                        فعال‌سازی
                      </Button>
                    )}
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardBody>
            <EmptyState
              icon={Heart}
              title="کمپینی ایجاد نشده است"
              description="برای جمع‌آوری وجه هدفمند، اولین کمپین را بسازید."
              action={
                <Button onClick={() => setOpen(true)}>
                  <Plus className="h-4 w-4" />
                  کمپین جدید
                </Button>
              }
            />
          </CardBody>
        </Card>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="ایجاد کمپین"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              انصراف
            </Button>
            <Button
              loading={createCampaign.isPending}
              disabled={form.title.trim().length < 2}
              onClick={() => createCampaign.mutate()}
            >
              ایجاد
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="عنوان"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <Input
            label="توضیح"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="مبلغ هدف"
              dir="ltr"
              className="text-left nums"
              value={form.targetAmount}
              onChange={(e) => setForm({ ...form, targetAmount: e.target.value.replace(/\D/g, '') })}
            />
            <Input
              label="حداقل کمک"
              dir="ltr"
              className="text-left nums"
              value={form.minAmount}
              onChange={(e) => setForm({ ...form, minAmount: e.target.value.replace(/\D/g, '') })}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
