'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Paperclip, Send } from 'lucide-react';
import { toast } from 'sonner';
import { api, API_BASE } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth';
import { cn, formatJalali } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState, Skeleton } from '@/components/ui/empty-state';
import type { ChatMessage, ChatThread } from '@/lib/types-extra';

export default function ChatPage() {
  const token = getAccessToken();
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [body, setBody] = useState('');

  const inboxQuery = useQuery({
    queryKey: ['chat-inbox'],
    queryFn: () => api.get<ChatThread[]>('/messages/chats', token),
    refetchInterval: 15_000,
  });

  const messagesQuery = useQuery({
    queryKey: ['chat-messages', activeId],
    queryFn: () =>
      api.get<{ data: ChatMessage[] }>(`/messages/chats/messages?customerId=${activeId}`, token),
    enabled: Boolean(activeId),
    refetchInterval: 10_000,
  });

  const send = useMutation({
    mutationFn: () =>
      api.post('/messages/chats', { customerId: activeId, body, direction: 'OUTBOUND' }, token),
    onSuccess: () => {
      setBody('');
      void queryClient.invalidateQueries({ queryKey: ['chat-messages', activeId] });
      void queryClient.invalidateQueries({ queryKey: ['chat-inbox'] });
    },
    onError: () => toast.error('ارسال پیام ناموفق بود'),
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${API_BASE}/api/v1/files/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? 'خطا در بارگذاری فایل');
      return json.data as { key: string };
    },
    onSuccess: (result) => {
      void api
        .post('/messages/chats', { customerId: activeId, fileKey: result.key, direction: 'OUTBOUND' }, token)
        .then(() => queryClient.invalidateQueries({ queryKey: ['chat-messages', activeId] }));
    },
  });

  const active = inboxQuery.data?.find((t) => t.customerId === activeId);
  const messages = messagesQuery.data?.data ?? [];

  return (
    <div className="space-y-5">
      <PageHeader title="گفتگوی فردی" description="پیام داخلی با مشتری و اشتراک فایل (MSG-05)" />
      <div className="grid gap-5 lg:grid-cols-[20rem_1fr]">
        <Card className="overflow-hidden">
          <CardBody className="max-h-[32rem] space-y-1 overflow-y-auto p-2">
            {inboxQuery.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : inboxQuery.data?.length ? (
              inboxQuery.data.map((t) => (
                <button
                  key={t.customerId}
                  type="button"
                  onClick={() => setActiveId(t.customerId)}
                  className={cn(
                    'w-full rounded-xl p-3 text-right transition',
                    activeId === t.customerId
                      ? 'bg-brand-50 dark:bg-brand-900/30'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{t.fullName}</span>
                    {t.unread > 0 && (
                      <span className="rounded-full bg-red-500 px-2 text-xs text-white">{t.unread}</span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-500">{t.lastBody ?? '—'}</p>
                </button>
              ))
            ) : (
              <EmptyState title="گفتگویی وجود ندارد" />
            )}
          </CardBody>
        </Card>

        <Card className="flex flex-col overflow-hidden">
          {activeId ? (
            <>
              <div className="border-b border-slate-100 p-4 dark:border-slate-800">
                <p className="font-medium">{active?.fullName}</p>
                <p className="text-xs text-slate-500">{active?.phone}</p>
              </div>
              <CardBody className="flex max-h-[26rem] flex-1 flex-col gap-2 overflow-y-auto">
                {messages.length ? (
                  messages
                    .slice()
                    .reverse()
                    .map((m) => (
                      <div
                        key={m.id}
                        className={cn(
                          'max-w-[75%] rounded-2xl px-3 py-2 text-sm',
                          m.direction === 'OUTBOUND'
                            ? 'self-end bg-brand-600 text-white'
                            : 'self-start bg-slate-100 dark:bg-slate-800',
                        )}
                      >
                        {m.body ?? (m.fileKey ? '📎 فایل پیوست' : '—')}
                        <div className="mt-1 text-[10px] opacity-70">{formatJalali(m.createdAt, true)}</div>
                      </div>
                    ))
                ) : (
                  <EmptyState title="پیامی رد و بدل نشده" />
                )}
              </CardBody>
              <div className="flex items-center gap-2 border-t border-slate-100 p-3 dark:border-slate-800">
                <label className="cursor-pointer rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                  <Paperclip className="h-4 w-4" />
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && upload.mutate(e.target.files[0])}
                  />
                </label>
                <input
                  className="h-11 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                  placeholder="پیام خود را بنویسید…"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && body && send.mutate()}
                />
                <Button loading={send.isPending} disabled={!body} onClick={() => send.mutate()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </>
          ) : (
            <CardBody>
              <EmptyState title="یک گفتگو را انتخاب کنید" description="از فهرست مشتری را انتخاب کنید." />
            </CardBody>
          )}
        </Card>
      </div>
    </div>
  );
}
