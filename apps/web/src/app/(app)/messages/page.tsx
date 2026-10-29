'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, Megaphone, Send, Users } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiClientError } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth';
import { formatJalali } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import type { Customer, Paginated } from '@/lib/types';

type Announcement = {
  id: string;
  title: string;
  body: string;
  audience: 'ALL' | 'SELECTED';
  eventDate: string | null;
  recipients: number;
  baleStatus: 'SENT' | 'FAILED' | 'SKIPPED';
  baleError: string | null;
  publishedAt: string;
};

type BaleSettings = { connected: boolean; chatTitle: string | null };

const EMPTY_FORM = { title: '', body: '', eventDate: '' };

/**
 * اطلاعیه‌ها (MSG-ANN) — انتشار یک‌باره برای همهٔ مشتریان یا گروه انتخابی.
 * هر اطلاعیه در پنل کاربری (`/me`) دیده می‌شود و در صورت فعال بودن اتصال بله،
 * همان متن به گروه بله هم می‌رود.
 */
export default function AnnouncementsPage() {
  const token = getAccessToken();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);
  const [audience, setAudience] = useState<'ALL' | 'SELECTED'>('ALL');
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [mirrorToBale, setMirrorToBale] = useState(true);

  const bale = useQuery({
    queryKey: ['bale-settings'],
    queryFn: () => api.get<BaleSettings>('/bale/settings', token),
  });

  const customers = useQuery({
    queryKey: ['announcement-customers', search],
    queryFn: () =>
      api.get<Paginated<Customer>>(
        `/customers?search=${encodeURIComponent(search)}&pageSize=50`,
        token,
      ),
    enabled: audience === 'SELECTED',
  });

  const history = useQuery({
    queryKey: ['announcements'],
    queryFn: () => api.get<{ data: Announcement[]; total: number }>('/messages/announcements?take=20', token),
  });

  const publish = useMutation({
    mutationFn: () =>
      api.post<Announcement & { bale: { status: string; error?: string } }>(
        '/messages/announcements',
        {
          title: form.title.trim(),
          body: form.body.trim(),
          audience,
          customerIds: audience === 'SELECTED' ? selected : undefined,
          eventDate: form.eventDate ? new Date(form.eventDate).toISOString() : undefined,
          mirrorToBale,
        },
        token,
      ),
    onSuccess: (result) => {
      const baleNote =
        result.bale.status === 'SENT'
          ? ' و در گروه بله ارسال شد'
          : result.bale.status === 'FAILED'
            ? ' (ارسال به بله ناموفق بود)'
            : '';
      toast.success(`اطلاعیه برای ${result.recipients} نفر منتشر شد${baleNote}`);
      setForm(EMPTY_FORM);
      setSelected([]);
      void queryClient.invalidateQueries({ queryKey: ['announcements'] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : 'انتشار اطلاعیه انجام نشد'),
  });

  const resend = useMutation({
    mutationFn: (id: string) => api.post<{ status: string; error?: string }>(`/messages/announcements/${id}/bale`, {}, token),
    onSuccess: (result) => {
      if (result.status === 'SENT') toast.success('اطلاعیه به گروه بله ارسال شد');
      else if (result.status === 'FAILED') toast.error(result.error ?? 'ارسال به بله ناموفق بود');
      else toast.warning('ارسال به بله انجام نشد؛ ابتدا اتصال بله را بررسی کنید');
      void queryClient.invalidateQueries({ queryKey: ['announcements'] });
    },
    onError: () => toast.error('ارسال دوباره انجام نشد'),
  });

  const toggleCustomer = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">اطلاعیه‌ها</h1>
        <p className="mt-1 text-sm text-slate-500">
          خبر، تعطیلی یا تغییر برنامه را یک‌بار منتشر کنید — در پنل کاربری اعضا و گروه بله دیده می‌شود
        </p>
      </div>

      <Card>
        <CardHeader
          title="اطلاعیهٔ تازه"
          description="مثلاً «باشگاه یکشنبه ۱۰ آبان تعطیل است»"
          action={
            bale.data?.connected ? (
              <Badge tone="success">
                <BellRing className="mr-1 h-3.5 w-3.5" />
                بله: {bale.data.chatTitle ?? 'متصل'}
              </Badge>
            ) : (
              <Badge tone="neutral">بله متصل نیست</Badge>
            )
          }
        />
        <CardBody className="space-y-4">
          <Input
            label="عنوان"
            placeholder="تعطیلی باشگاه"
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
          />
          <div className="space-y-1.5">
            <label htmlFor="announcement-body" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              متن اطلاعیه
            </label>
            <textarea
              id="announcement-body"
              rows={4}
              value={form.body}
              onChange={(event) => setForm({ ...form, body: event.target.value })}
              placeholder="روز یکشنبه ۱۰ آبان باشگاه تعطیل است. کلاس‌های جبرانی هفتهٔ بعد برگزار می‌شود."
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            <p className="text-xs text-slate-500">{form.body.trim().length} / ۲۰۰۰ نویسه</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Input
                label="روز رویداد (اختیاری)"
                type="date"
                dir="ltr"
                className="text-left nums"
                value={form.eventDate}
                onChange={(event) => setForm({ ...form, eventDate: event.target.value })}
              />
              {form.eventDate ? (
                <p className="text-xs text-slate-500">معادل شمسی: {formatJalali(form.eventDate)}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">گیرندگان</span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setAudience('ALL')}
                  className={`rounded-xl border px-3 py-2 text-sm ${
                    audience === 'ALL'
                      ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200'
                      : 'border-slate-200 text-slate-600 dark:border-slate-700'
                  }`}
                >
                  همهٔ اعضا
                </button>
                <button
                  type="button"
                  onClick={() => setAudience('SELECTED')}
                  className={`rounded-xl border px-3 py-2 text-sm ${
                    audience === 'SELECTED'
                      ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200'
                      : 'border-slate-200 text-slate-600 dark:border-slate-700'
                  }`}
                >
                  انتخاب گروهی
                </button>
              </div>
            </div>
          </div>

          {audience === 'SELECTED' ? (
            <div className="space-y-2 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
                  <Users className="h-4 w-4" /> انتخاب اعضا
                  <span className="text-xs text-slate-500">({selected.length} نفر)</span>
                </p>
                <Input
                  placeholder="جست‌وجو…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="h-9 w-44"
                />
              </div>
              <div className="max-h-56 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
                {customers.data?.data.length ? (
                  customers.data.data.map((customer) => (
                    <label key={customer.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selected.includes(customer.id)}
                          onChange={() => toggleCustomer(customer.id)}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        <span className="text-slate-800 dark:text-slate-100">{customer.fullName}</span>
                      </span>
                      <span dir="ltr" className="nums text-xs text-slate-500">
                        {customer.phone ?? '—'}
                      </span>
                    </label>
                  ))
                ) : (
                  <p className="py-3 text-sm text-slate-500">مشتری‌ای پیدا نشد</p>
                )}
              </div>
            </div>
          ) : null}

          <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
            <input
              type="checkbox"
              checked={mirrorToBale}
              onChange={(event) => setMirrorToBale(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">
              ارسال همین اطلاعیه به گروه بیام‌رسان بله
              <span className="mt-1 block text-xs text-slate-500">
                {bale.data?.connected
                  ? `مقصد: ${bale.data.chatTitle ?? 'گروه متصل'}`
                  : 'اتصال بله فعال نیست؛ از تنظیمات آن را وصل کنید'}
              </span>
            </span>
          </label>

          <Button
            loading={publish.isPending}
            disabled={!form.title.trim() || !form.body.trim() || (audience === 'SELECTED' && !selected.length)}
            onClick={() => publish.mutate()}
          >
            <Send className="h-4 w-4" />
            انتشار اطلاعیه
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="اطلاعیه‌های منتشرشده" description={`${history.data?.total ?? 0} مورد`} />
        <CardBody>
          {history.data?.data.length ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {history.data.data.map((item) => (
                <div key={item.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{item.title}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-500">{item.body}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {formatJalali(item.publishedAt, true)} — {item.recipients} گیرنده
                      {item.eventDate ? ` — رویداد: ${formatJalali(item.eventDate)}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.baleStatus === 'SENT' ? (
                      <Badge tone="success">بله: ارسال شد</Badge>
                    ) : item.baleStatus === 'FAILED' ? (
                      <Badge tone="danger">بله: ناموفق</Badge>
                    ) : (
                      <Badge tone="neutral">فقط سایت</Badge>
                    )}
                    {item.baleStatus !== 'SENT' ? (
                      <Button size="sm" variant="outline" loading={resend.isPending} onClick={() => resend.mutate(item.id)}>
                        ارسال به بله
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Megaphone}
              title="هنوز اطلاعیه‌ای منتشر نشده"
              description="اولین اطلاعیه را از فرم بالا منتشر کنید؛ بلافاصله در پنل اعضا دیده می‌شود."
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
