'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Megaphone, Send, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiClientError } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth';
import { formatNumber } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, Td, Th } from '@/components/ui/table';
import { Modal } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import type { ShareCard, SmsCampaign } from '@/lib/types-extra';

const STATUS_LABELS: Record<string, string> = { DRAFT: 'پیش‌نویس', SENDING: 'در حال ارسال', SENT: 'ارسال‌شده' };

export default function MarketingCampaignsPage() {
  const token = getAccessToken();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const [form, setForm] = useState({ title: '', body: '', tag: '' });
  const [cardForm, setCardForm] = useState({ title: '', subtitle: '', theme: 'brand' as 'brand' | 'dark' | 'light' });
  const [preview, setPreview] = useState<{ count: number } | null>(null);

  const campaignsQuery = useQuery({
    queryKey: ['sms-campaigns'],
    queryFn: () => api.get<SmsCampaign[]>('/marketing/sms-campaigns', token),
  });

  const previewSegment = useMutation({
    mutationFn: () =>
      api.post<{ count: number }>(
        '/marketing/sms-campaigns/preview',
        { segment: form.tag ? { tags: [form.tag] } : {} },
        token,
      ),
    onSuccess: setPreview,
  });

  const createCampaign = useMutation({
    mutationFn: () =>
      api.post(
        '/marketing/sms-campaigns',
        { title: form.title, body: form.body, segment: form.tag ? { tags: [form.tag] } : {} },
        token,
      ),
    onSuccess: () => {
      toast.success('کمپین ساخته شد');
      setCreateOpen(false);
      setForm({ title: '', body: '', tag: '' });
      setPreview(null);
      void queryClient.invalidateQueries({ queryKey: ['sms-campaigns'] });
    },
    onError: (e) => toast.error(e instanceof ApiClientError ? e.message : 'خطا'),
  });

  const sendCampaign = useMutation({
    mutationFn: (id: string) => api.post(`/marketing/sms-campaigns/${id}/send`, {}, token),
    onSuccess: () => {
      toast.success('کمپین در حال ارسال است');
      void queryClient.invalidateQueries({ queryKey: ['sms-campaigns'] });
    },
    onError: (e) => toast.error(e instanceof ApiClientError ? e.message : 'خطا در ارسال'),
  });

  const shareCard = useMutation({
    mutationFn: () =>
      api.post<ShareCard>(
        '/marketing/share-card',
        { title: cardForm.title, subtitle: cardForm.subtitle || undefined, theme: cardForm.theme },
        token,
      ),
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="کمپین پیامکی هدفمند"
        description="فیلتر مخاطبان، ارسال انبوه و کارت اشتراک شبکه‌های اجتماعی (MKT-04/08)"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setCardOpen(true)}>
              <Share2 className="h-4 w-4" />
              کارت اشتراک
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Megaphone className="h-4 w-4" />
              کمپین جدید
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader title="کمپین‌های پیامکی" />
        <CardBody>
          {campaignsQuery.data?.length ? (
            <Table>
              <thead>
                <tr>
                  <Th>عنوان</Th>
                  <Th>متن</Th>
                  <Th>هدف</Th>
                  <Th>ارسال</Th>
                  <Th>وضعیت</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {campaignsQuery.data.map((c) => (
                  <tr key={c.id}>
                    <Td>{c.title}</Td>
                    <Td className="max-w-[16rem] truncate">{c.body}</Td>
                    <Td>{formatNumber(c.totalTargets)}</Td>
                    <Td>{formatNumber(c.sentCount)}</Td>
                    <Td>
                      <Badge tone={c.status === 'SENT' ? 'success' : c.status === 'SENDING' ? 'info' : 'neutral'}>
                        {STATUS_LABELS[c.status] ?? c.status}
                      </Badge>
                    </Td>
                    <Td>
                      {c.status === 'DRAFT' && (
                        <Button size="sm" loading={sendCampaign.isPending} onClick={() => sendCampaign.mutate(c.id)}>
                          <Send className="h-3.5 w-3.5" />
                          ارسال
                        </Button>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState title="کمپینی ثبت نشده" description="اولین کمپین پیامکی خود را بسازید." />
          )}
        </CardBody>
      </Card>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="کمپین پیامکی جدید"
        footer={
          <>
            <Button variant="ghost" loading={previewSegment.isPending} onClick={() => previewSegment.mutate()}>
              پیش‌نمایش مخاطبان
            </Button>
            <Button loading={createCampaign.isPending} onClick={() => createCampaign.mutate()}>
              ساخت
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input label="عنوان" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Input label="متن پیام" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          <Input
            label="برچسب مخاطب (اختیاری)"
            hint="مثلاً VIP یا بدهکار"
            value={form.tag}
            onChange={(e) => setForm({ ...form, tag: e.target.value })}
          />
          {preview && (
            <p className="rounded-xl bg-brand-50 p-3 text-sm text-brand-700 dark:bg-brand-900/30">
              {formatNumber(preview.count)} مخاطب واجد شرایط یافت شد
            </p>
          )}
        </div>
      </Modal>

      <Modal
        open={cardOpen}
        onClose={() => setCardOpen(false)}
        title="کارت اشتراک شبکه‌های اجتماعی (MKT-08)"
        footer={
          <Button loading={shareCard.isPending} onClick={() => shareCard.mutate()}>
            ساخت کارت
          </Button>
        }
      >
        <div className="space-y-3">
          <Input label="عنوان" value={cardForm.title} onChange={(e) => setCardForm({ ...cardForm, title: e.target.value })} />
          <Input label="زیرعنوان" value={cardForm.subtitle} onChange={(e) => setCardForm({ ...cardForm, subtitle: e.target.value })} />
          <select
            className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
            value={cardForm.theme}
            onChange={(e) => setCardForm({ ...cardForm, theme: e.target.value as typeof cardForm.theme })}
          >
            <option value="brand">برند</option>
            <option value="dark">تیره</option>
            <option value="light">روشن</option>
          </select>
          {shareCard.data && (
            <div className="space-y-2">
              <div
                className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700"
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: shareCard.data.svg }}
              />
              <a
                href={shareCard.data.dataUri}
                download="share-card.svg"
                className="inline-block text-sm text-brand-600 hover:underline"
              >
                دانلود کارت
              </a>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
