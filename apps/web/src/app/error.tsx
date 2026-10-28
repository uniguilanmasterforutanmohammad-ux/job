'use client';

import { Button } from '@/components/ui/button';

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-lg font-bold text-slate-800 dark:text-slate-200">خطایی رخ داد</p>
      <p className="text-sm text-slate-500">متأسفانه مشکلی در نمایش این صفحه پیش آمد.</p>
      <Button onClick={reset}>تلاش مجدد</Button>
    </main>
  );
}
