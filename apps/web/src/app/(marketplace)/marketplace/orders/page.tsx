'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PackageSearch } from 'lucide-react';
import { toast } from 'sonner';
import { formatJalali, formatToman } from '@/lib/utils';
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONES } from '@/lib/status';
import { marketplaceFetch, type MarketplaceTrackedOrder } from '@/lib/marketplace';
import { Badge } from '@/components/ui/badge';

const STEPS = ['PENDING', 'CONFIRMED', 'PREPARING', 'SHIPPED', 'DELIVERED'] as const;

export default function MarketplaceOrderTrackingPage() {
  const [number, setNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<MarketplaceTrackedOrder | null>(null);

  async function track() {
    if (!number.trim() || !/^09\d{9}$/.test(phone)) {
      toast.error('شمارهٔ سفارش و موبایل را کامل وارد کنید');
      return;
    }
    setBusy(true);
    setOrder(null);
    try {
      const data = await marketplaceFetch<MarketplaceTrackedOrder>(
        `/orders/track?number=${encodeURIComponent(number.trim())}&phone=${phone}`,
      );
      setOrder(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'سفارش پیدا نشد');
    } finally {
      setBusy(false);
    }
  }

  const stepIndex = order ? STEPS.indexOf(order.status as (typeof STEPS)[number]) : -1;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-black text-slate-900 dark:text-slate-100">پیگیری سفارش</h1>
        <p className="mt-1 text-sm text-slate-500">
          شمارهٔ سفارش و همان شمارهٔ موبایلی که هنگام خرید وارد کردید را بدهید.
        </p>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void track();
        }}
        className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_1fr_auto] dark:border-slate-800 dark:bg-slate-900"
      >
        <label>
          <span className="mb-1 block text-xs text-slate-500">شمارهٔ سفارش</span>
          <input
            value={number}
            onChange={(event) => setNumber(event.target.value)}
            dir="ltr"
            placeholder="ORD-00001"
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-left text-sm dark:border-slate-700 dark:bg-slate-950"
          />
        </label>
        <label>
          <span className="mb-1 block text-xs text-slate-500">شماره موبایل</span>
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value.replace(/[^\d]/g, ''))}
            dir="ltr"
            placeholder="09xxxxxxxxx"
            className="nums w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-left text-sm dark:border-slate-700 dark:bg-slate-950"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="self-end rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {busy ? 'در حال جست‌وجو…' : 'پیگیری'}
        </button>
      </form>

      {order ? (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="nums text-sm font-black text-slate-900 dark:text-slate-100">
                {order.number}
              </p>
              <Link
                href={`/marketplace/b/${order.tenant.slug}`}
                className="text-xs text-slate-500 hover:text-brand-600"
              >
                {order.tenant.name}
              </Link>
            </div>
            <Badge tone={ORDER_STATUS_TONES[order.status]}>{ORDER_STATUS_LABELS[order.status]}</Badge>
          </div>

          {order.status !== 'CANCELED' ? (
            <ol className="grid grid-cols-5 gap-1">
              {STEPS.map((step, index) => {
                const done = stepIndex >= index;
                return (
                  <li key={step} className="space-y-1 text-center">
                    <div
                      className={`mx-auto h-1.5 rounded-full ${done ? 'bg-brand-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                    />
                    <span
                      className={`block text-[10px] leading-4 ${
                        done ? 'font-bold text-brand-700 dark:text-brand-300' : 'text-slate-400'
                      }`}
                    >
                      {ORDER_STATUS_LABELS[step]}
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : null}

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {order.items.map((item) => (
              <div key={item.title} className="flex items-center justify-between py-2 text-sm">
                <span className="text-slate-700 dark:text-slate-200">
                  {item.title} × {item.quantity.toLocaleString('fa-IR')}
                </span>
                <span className="nums text-slate-500">
                  {formatToman(item.unitPrice * item.quantity)}
                </span>
              </div>
            ))}
          </div>

          <div className="space-y-1 border-t border-slate-100 pt-2 text-sm dark:border-slate-800">
            <div className="flex justify-between text-slate-500">
              <span>جمع کالاها</span>
              <span className="nums">{formatToman(order.subtotal)}</span>
            </div>
            <div className="flex justify-between font-bold text-slate-900 dark:text-slate-100">
              <span>مبلغ کل</span>
              <span className="nums">{formatToman(order.total)}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-[11px] text-slate-500">
            <span>ثبت: {formatJalali(order.createdAt, true)}</span>
            {order.trackingCode ? <span>کد رهگیری: {order.trackingCode}</span> : null}
            {order.shippingMethod ? <span>روش ارسال: {order.shippingMethod}</span> : null}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">
          <PackageSearch className="mx-auto mb-2 h-8 w-8 text-slate-400" />
          نتیجهٔ پیگیری اینجا نمایش داده می‌شود.
        </div>
      )}
    </div>
  );
}
