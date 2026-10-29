'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, CheckCircle2, RefreshCw, Send, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiClientError } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth';
import { formatJalali } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

type BaleEvent =
  | 'announcement'
  | 'order.created'
  | 'order.canceled'
  | 'order.shipped'
  | 'appointment_reminder'
  | 'document.expiring';

type BaleSettings = {
  configured: boolean;
  connected: boolean;
  botUsername: string | null;
  botTokenMasked: string | null;
  groupLink: string | null;
  chatId: string | null;
  chatTitle: string | null;
  adminConfirmed: boolean;
  isActive: boolean;
  events: BaleEvent[];
  availableEvents: BaleEvent[];
  lastTestedAt: string | null;
  lastTestStatus: 'OK' | 'FAILED' | null;
  lastError: string | null;
};

type BaleCandidate = {
  chatId: string;
  title: string;
  type: string;
  status: string;
  isAdmin: boolean;
  inviteLink: string | null;
};

const EVENT_LABELS: Record<BaleEvent, string> = {
  announcement: 'اطلاعیه‌های پنل',
  'order.created': 'سفارش تازه',
  'order.canceled': 'لغو سفارش',
  'order.shipped': 'ارسال سفارش',
  appointment_reminder: 'یادآوری نوبت',
  'document.expiring': 'انقضای مدارک',
};

/**
 * MSG-BALE — the same notifications the site produces are mirrored into a Bale
 * (بیام‌رسان) group by a bot that must be an admin of that group.
 */
export function BaleConnectionCard() {
  const token = getAccessToken();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<{
    botToken?: string;
    groupLink?: string;
    chatId?: string;
    adminConfirmed?: boolean;
  }>({});
  const [candidates, setCandidates] = useState<BaleCandidate[] | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['bale-settings'],
    queryFn: () => api.get<BaleSettings>('/bale/settings', token),
  });

  // Derived, not copied into state: avoids a setState-in-effect render loop.
  const groupLink = form.groupLink ?? data?.groupLink ?? '';
  const chatId = form.chatId ?? data?.chatId ?? '';
  const adminConfirmed = form.adminConfirmed ?? data?.adminConfirmed ?? false;

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['bale-settings'] });

  const save = useMutation({
    mutationFn: () =>
      api.put<BaleSettings & { verification?: { isAdmin: boolean; message: string | null } }>(
        '/bale/settings',
        {
          botToken: form.botToken?.trim() || undefined,
          groupLink: groupLink.trim() || undefined,
          chatId: chatId.trim() || undefined,
          adminConfirmed,
        },
        token,
      ),
    onSuccess: (result) => {
      if (result.verification?.isAdmin) toast.success(result.verification.message ?? 'اتصال بله ذخیره شد');
      else toast.warning(result.verification?.message ?? 'ذخیره شد، اما دسترسی ادمین تأیید نشد');
      setForm((current) => ({ ...current, botToken: undefined }));
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : 'ذخیرهٔ اتصال انجام نشد'),
  });

  const discover = useMutation({
    mutationFn: () =>
      api.post<{ candidates: BaleCandidate[]; matchedChatId: string | null; hint: string | null }>(
        '/bale/discover',
        { groupLink: groupLink.trim() || undefined },
        token,
      ),
    onSuccess: (result) => {
      setCandidates(result.candidates);
      if (result.matchedChatId) {
        setForm((current) => ({ ...current, chatId: result.matchedChatId! }));
        toast.success('گروه از لینک شناسایی شد');
      } else if (result.candidates.length) {
        toast.info('گروه(ها) پیدا شد؛ گروه مقصد را انتخاب کنید');
      } else {
        toast.warning(result.hint ?? 'گروهی پیدا نشد');
      }
    },
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : 'تشخیص گروه انجام نشد'),
  });

  const test = useMutation({
    mutationFn: () => api.post<{ chatTitle: string | null }>('/bale/test', {}, token),
    onSuccess: (result) => {
      toast.success(`پیام آزمایشی به «${result.chatTitle ?? 'گروه'}» ارسال شد`);
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : 'ارسال پیام آزمایشی ناموفق بود'),
  });

  const disconnect = useMutation({
    mutationFn: () => api.delete('/bale/settings', token),
    onSuccess: () => {
      toast.success('اتصال بله قطع شد');
      setCandidates(null);
      setForm({});
      invalidate();
    },
    onError: () => toast.error('قطع اتصال انجام نشد'),
  });

  const toggleEvent = (event: BaleEvent) => {
    const events = data?.events ?? [];
    const next = events.includes(event) ? events.filter((item) => item !== event) : [...events, event];
    api
      .put('/bale/settings', { events: next }, token)
      .then(() => {
        toast.success('رویدادهای هم‌سان‌سازی ذخیره شد');
        invalidate();
      })
      .catch(() => toast.error('ذخیرهٔ رویدادها انجام نشد'));
  };

  return (
    <Card>
      <CardHeader
        title="اتصال به بیام‌رسان بله"
        description="اطلاعیه‌ها و رویدادهای انتخابی سایت، به‌صورت خودکار در گروه بله هم ارسال شوند"
        action={
          data?.connected ? (
            <Badge tone="success">
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
              متصل
            </Badge>
          ) : (
            <Badge tone="neutral">متصل نیست</Badge>
          )
        }
      />
      <CardBody className="space-y-5">
        {isLoading ? (
          <p className="text-sm text-slate-500">در حال بارگذاری…</p>
        ) : (
          <>
            <div className="rounded-xl bg-slate-50 p-4 text-xs leading-6 text-slate-600 dark:bg-slate-800/50 dark:text-slate-300">
              <p className="mb-1 flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-200">
                <Bot className="h-4 w-4" /> راه‌اندازی در ۳ گام
              </p>
              <ol className="list-inside list-decimal space-y-0.5">
                <li>در بله یک بازو (ربات) بسازید و توکن آن را اینجا وارد کنید.</li>
                <li>ربات را به گروه افزوده و با دسترسی «ارسال پیام» ادمین کنید.</li>
                <li>لینک دعوت گروه را بگذارید، تیک تأیید را بزنید و «پیام آزمایشی» را ارسال کنید.</li>
              </ol>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="توکن ربات"
                dir="ltr"
                className="text-left"
                placeholder={data?.botTokenMasked ?? '123456789:AA…'}
                value={form.botToken ?? ''}
                onChange={(event) => setForm({ ...form, botToken: event.target.value })}
                hint={
                  data?.botTokenMasked
                    ? `توکن ذخیره‌شده: ${data.botTokenMasked} (برای تغییر، توکن تازه بگذارید)`
                    : 'توکن از پنل بازو در بله گرفته می‌شود'
                }
              />
              <Input
                label="لینک گروه"
                dir="ltr"
                className="text-left"
                placeholder="ble.ir/join/…"
                value={groupLink}
                onChange={(event) => setForm({ ...form, groupLink: event.target.value })}
              />
              <Input
                label="شناسهٔ گروه (اختیاری)"
                dir="ltr"
                className="text-left nums"
                placeholder="با «تشخیص گروه» پر می‌شود"
                value={chatId}
                onChange={(event) => setForm({ ...form, chatId: event.target.value })}
              />
              <div className="space-y-1.5">
                <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">گروه مقصد</span>
                <div className="flex h-11 items-center rounded-xl border border-slate-200 px-3.5 text-sm dark:border-slate-700">
                  {data?.chatTitle ?? 'هنوز مشخص نشده'}
                </div>
              </div>
            </div>

            <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
              <input
                type="checkbox"
                checked={adminConfirmed}
                onChange={(event) => setForm({ ...form, adminConfirmed: event.target.checked })}
                className="mt-1 h-4 w-4 rounded border-slate-300"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">
                تأیید می‌کنم ربات را به‌عنوان <b>ادمین</b> با دسترسی «ارسال پیام» به این گروه افزوده‌ام.
                <span className="mt-1 block text-xs text-slate-500">
                  هنگام ذخیره و تست، عضویت و سطح دسترسی ربات به‌صورت خودکار از بله بررسی می‌شود.
                </span>
              </span>
            </label>

            {candidates?.length ? (
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
                  <Users className="h-4 w-4" /> گروه‌هایی که ربات در آن‌هاست
                </p>
                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                  {candidates.map((candidate) => (
                    <button
                      key={candidate.chatId}
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, chatId: candidate.chatId }))}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-right text-sm hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    >
                      <span>
                        <span className="font-medium text-slate-800 dark:text-slate-100">{candidate.title}</span>
                        <span className="mt-0.5 block text-xs text-slate-500" dir="ltr">
                          {candidate.chatId}
                        </span>
                      </span>
                      <Badge tone={candidate.isAdmin ? 'success' : 'warning'}>
                        {candidate.isAdmin ? 'ادمین' : `عضو (${candidate.status})`}
                      </Badge>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {data?.lastTestedAt ? (
              <p className="text-xs text-slate-500">
                آخرین بررسی: {formatJalali(data.lastTestedAt, true)} —{' '}
                {data.lastTestStatus === 'OK' ? (
                  <span className="text-emerald-600">موفق</span>
                ) : (
                  <span className="text-red-600">{data.lastError ?? 'ناموفق'}</span>
                )}
              </p>
            ) : data?.lastError ? (
              <p className="text-xs text-red-600">{data.lastError}</p>
            ) : null}

            {data?.configured ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  کدام رویدادها به بله منتقل شوند؟
                </p>
                <div className="flex flex-wrap gap-2">
                  {data.availableEvents.map((event) => (
                    <button
                      key={event}
                      type="button"
                      onClick={() => toggleEvent(event)}
                      className={`rounded-full border px-3 py-1 text-xs transition ${
                        data.events.includes(event)
                          ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200'
                          : 'border-slate-200 text-slate-500 dark:border-slate-700'
                      }`}
                    >
                      {EVENT_LABELS[event]}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button loading={save.isPending} onClick={() => save.mutate()}>
                ذخیرهٔ اتصال
              </Button>
              <Button
                variant="outline"
                loading={discover.isPending}
                disabled={!data?.configured && !form.botToken?.trim()}
                onClick={() => discover.mutate()}
              >
                <RefreshCw className="h-4 w-4" />
                تشخیص گروه
              </Button>
              <Button
                variant="outline"
                loading={test.isPending}
                disabled={!data?.configured}
                onClick={() => test.mutate()}
              >
                <Send className="h-4 w-4" />
                پیام آزمایشی
              </Button>
              {data?.configured ? (
                <Button variant="ghost" loading={disconnect.isPending} onClick={() => disconnect.mutate()}>
                  <Trash2 className="h-4 w-4" />
                  قطع اتصال
                </Button>
              ) : null}
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
