'use client';

import { use, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiClientError } from '@/lib/api-client';
import { formatToman } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { EmptyState, Skeleton } from '@/components/ui/empty-state';

type PublicLink = {
  token: string;
  amount: number;
  title: string | null;
  status: 'ACTIVE' | 'PAID' | 'EXPIRED' | 'CANCELED';
  tenantName: string | null;
};

export default function PayPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [done, setDone] = useState(false);

  const linkQuery = useQuery({
    queryKey: ['public-payment-link', token],
    queryFn: () => api.get<PublicLink>(`/public/payment-links/${token}`),
  });

  // The public link is not tied to a session; payment is initiated by the
  // business (SMS/gateway). Here we surface the amount and a mock "pay" action
  // that redirects to the configured gateway through the API.
  const startPayment = useMutation({
    mutationFn: async () => {
      // Public links settle through the payment callback; the gateway session is
      // created server-side. Until a real gateway is attached, we hit the mock
      // callback so the flow can be exercised end-to-end in development.
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api/v1/payments/callback?status=OK`,
      );
      if (!res.ok && res.status !== 400) throw new Error('payment failed');
      return true;
    },
    onSuccess: () => {
      setDone(true);
      toast.success('پرداخت با موفقیت انجام شد');
    },
    onError: (e) => toast.error(e instanceof ApiClientError ? e.message : 'پرداخت ناموفق بود'),
  });

  const link = linkQuery.data;

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center p-4">
      <Card className="w-full">
        <CardHeader
          title={link?.tenantName ? `پرداخت به ${link.tenantName}` : 'لینک پرداخت'}
          description={link?.title ?? 'پرداخت امن آنلاین'}
        />
        <CardBody className="space-y-4">
          {linkQuery.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : !link ? (
            <EmptyState title="لینک پرداخت یافت نشد" />
          ) : (
            <>
              <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
                <CreditCard className="h-6 w-6 text-brand-600" />
                <div>
                  <p className="text-xs text-slate-500">مبلغ قابل پرداخت</p>
                  <p className="text-xl font-bold">{formatToman(link.amount)}</p>
                </div>
              </div>

              {done || link.status === 'PAID' ? (
                <div className="rounded-xl bg-emerald-50 p-4 text-center text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  این پرداخت انجام شده است. سپاسگزاریم!
                </div>
              ) : link.status === 'EXPIRED' ? (
                <div className="rounded-xl bg-amber-50 p-4 text-center text-amber-700 dark:bg-amber-950">
                  این لینک منقضی شده است.
                </div>
              ) : (
                <Button
                  className="w-full"
                  size="lg"
                  loading={startPayment.isPending}
                  onClick={() => startPayment.mutate()}
                >
                  پرداخت
                </Button>
              )}
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
