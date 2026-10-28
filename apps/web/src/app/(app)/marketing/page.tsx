'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Gift, Plus, Sparkles, Star } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiClientError } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth';
import { useEndUserNoun } from '@/lib/use-industry-registry';
import { formatJalali, formatToman } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, Td, Th } from '@/components/ui/table';
import { Modal } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState, Skeleton } from '@/components/ui/empty-state';
import { GIFT_CARD_STATUS_LABELS } from '@/lib/status';
import type { GiftCard, Paginated, Review } from '@/lib/types';

export default function MarketingPage() {
  const { plural } = useEndUserNoun();
  const token = getAccessToken();
  const queryClient = useQueryClient();
  const [giftOpen, setGiftOpen] = useState(false);
  const [form, setForm] = useState({ code: '', balance: '0' });

  const giftQuery = useQuery({
    queryKey: ['gift-cards'],
    queryFn: () => api.get<GiftCard[]>('/marketing/gift-cards', token),
  });

  const reviewsQuery = useQuery({
    queryKey: ['reviews'],
    queryFn: () => api.get<Paginated<Review>>('/marketing/reviews?pageSize=50', token),
  });

  const createGift = useMutation({
    mutationFn: () =>
      api.post('/marketing/gift-cards', { code: form.code || undefined, balance: Number(form.balance) }, token),
    onSuccess: () => {
      toast.success('کارت هدیه صادر شد');
      setGiftOpen(false);
      setForm({ code: '', balance: '0' });
      void queryClient.invalidateQueries({ queryKey: ['gift-cards'] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : 'خطا در صدور کارت هدیه'),
  });

  const moderate = useMutation({
    mutationFn: ({ id, isPublic }: { id: string; isPublic: boolean }) =>
      api.patch(`/marketing/reviews/${id}`, { isPublic }, token),
    onSuccess: () => {
      toast.success('وضعیت نظر به‌روزرسانی شد');
      void queryClient.invalidateQueries({ queryKey: ['reviews'] });
    },
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="وفاداری و بازاریابی"
        description={`باشگاه ${plural}، کارت هدیه، معرفی دوست و نظرات`}
        action={
          <Button onClick={() => setGiftOpen(true)}>
            <Plus className="h-4 w-4" />
            کارت هدیه جدید
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardBody className="flex items-center gap-3">
            <div className="rounded-xl bg-amber-50 p-2.5 dark:bg-amber-950/40">
              <Star className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">کارت‌های هدیه فعال</p>
              <p className="nums text-lg font-bold">
                {giftQuery.data?.filter((g) => g.status === 'ACTIVE').length ?? 0}
              </p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-50 p-2.5 dark:bg-emerald-950/40">
              <Sparkles className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">نظرات ثبت‌شده</p>
              <p className="nums text-lg font-bold">{reviewsQuery.data?.meta.total ?? 0}</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-3">
            <div className="rounded-xl bg-sky-50 p-2.5 dark:bg-sky-950/40">
              <Gift className="h-5 w-5 text-sky-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">نظرات تأییدشده</p>
              <p className="nums text-lg font-bold">
                {reviewsQuery.data?.data.filter((r) => r.isPublic).length ?? 0}
              </p>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="کارت‌های هدیه" />
        <CardBody className="p-0">
          {giftQuery.isLoading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : giftQuery.data && giftQuery.data.length > 0 ? (
            <Table>
              <thead>
                <tr>
                  <Th>کد</Th>
                  <Th>موجودی</Th>
                  <Th>انقضا</Th>
                  <Th>وضعیت</Th>
                </tr>
              </thead>
              <tbody>
                {giftQuery.data.map((g) => (
                  <tr key={g.id}>
                    <Td className="font-medium nums">{g.code}</Td>
                    <Td className="nums">{formatToman(g.balance)}</Td>
                    <Td className="nums">{formatJalali(g.expiresAt)}</Td>
                    <Td>
                      <Badge tone={g.status === 'ACTIVE' ? 'success' : 'neutral'}>
                        {GIFT_CARD_STATUS_LABELS[g.status]}
                      </Badge>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState icon={Gift} title="کارت هدیه‌ای صادر نشده است" />
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={`نظرات ${plural}`} />
        <CardBody className="p-0">
          {reviewsQuery.data && reviewsQuery.data.data.length > 0 ? (
            <Table>
              <thead>
                <tr>
                  <Th>امتیاز</Th>
                  <Th>متن</Th>
                  <Th>تاریخ</Th>
                  <Th>نمایش عمومی</Th>
                </tr>
              </thead>
              <tbody>
                {reviewsQuery.data.data.map((r) => (
                  <tr key={r.id}>
                    <Td>
                      <span className="nums">{'★'.repeat(r.rating)}</span>
                    </Td>
                    <Td className="max-w-xs truncate">{r.comment ?? '—'}</Td>
                    <Td className="nums">{formatJalali(r.createdAt)}</Td>
                    <Td>
                      {r.isPublic ? (
                        <Button size="sm" variant="outline" onClick={() => moderate.mutate({ id: r.id, isPublic: false })}>
                          لغو نمایش
                        </Button>
                      ) : (
                        <Button size="sm" onClick={() => moderate.mutate({ id: r.id, isPublic: true })}>
                          تأیید
                        </Button>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <p className="p-5 text-sm text-slate-500">نظری ثبت نشده است.</p>
          )}
        </CardBody>
      </Card>

      <Modal
        open={giftOpen}
        onClose={() => setGiftOpen(false)}
        title="صدور کارت هدیه"
        footer={
          <>
            <Button variant="outline" onClick={() => setGiftOpen(false)}>
              انصراف
            </Button>
            <Button loading={createGift.isPending} onClick={() => createGift.mutate()}>
              صدور
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="کد (اختیاری)"
            dir="ltr"
            className="text-left nums"
            hint="اگر خالی بماند به‌صورت خودکار تولید می‌شود"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
          />
          <Input
            label="موجودی (تومان)"
            dir="ltr"
            className="text-left nums"
            value={form.balance}
            onChange={(e) => setForm({ ...form, balance: e.target.value.replace(/\D/g, '') })}
          />
        </div>
      </Modal>
    </div>
  );
}
