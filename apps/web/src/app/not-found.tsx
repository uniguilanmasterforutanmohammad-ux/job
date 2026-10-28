import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-5xl font-bold text-brand-600 nums">۴۰۴</p>
      <p className="text-slate-600 dark:text-slate-400">صفحه‌ای که دنبال آن بودید پیدا نشد.</p>
      <Link href="/dashboard">
        <Button>بازگشت به داشبورد</Button>
      </Link>
    </main>
  );
}
