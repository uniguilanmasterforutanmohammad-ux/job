'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';

function ResultContent() {
  const params = useSearchParams();
  const status = params.get('status');
  const ref = params.get('ref');
  const message = params.get('message');
  const success = status === 'success';

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4 dark:bg-slate-950">
      <Card className="w-full max-w-md">
        <CardBody className="flex flex-col items-center gap-4 py-8 text-center">
          {success ? (
            <CheckCircle2 className="h-14 w-14 text-emerald-500" />
          ) : (
            <XCircle className="h-14 w-14 text-red-500" />
          )}
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {success ? 'پرداخت با موفقیت انجام شد' : 'پرداخت ناموفق بود'}
          </h1>
          {ref && (
            <p className="text-sm text-slate-500">
              کد پیگیری: <span className="font-mono nums">{ref}</span>
            </p>
          )}
          {message && <p className="text-sm text-red-600">{message}</p>}
          <Link href="/dashboard" className="w-full">
            <Button className="w-full">بازگشت به داشبورد</Button>
          </Link>
        </CardBody>
      </Card>
    </main>
  );
}

export default function PaymentResultPage() {
  return (
    <Suspense fallback={null}>
      <ResultContent />
    </Suspense>
  );
}
