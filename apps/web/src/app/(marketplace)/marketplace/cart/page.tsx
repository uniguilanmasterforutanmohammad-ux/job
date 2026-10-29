'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CreditCard, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatToman } from '@/lib/utils';
import { clearCart, readCart, writeCart, type CartItem } from '@/lib/marketplace-cart';
import { marketplaceFetch } from '@/lib/marketplace';
import { EmptyState } from '@/components/ui/empty-state';

type CheckoutResult = {
  tenant: { slug: string; name: string };
  order: { id: string; number: string; status: string; total: string };
  payment: { paymentId: string; redirectUrl: string; provider: string } | null;
};

export default function MarketplaceCartPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CheckoutResult | null>(null);

  useEffect(() => {
    setItems(readCart());
    setReady(true);
  }, []);

  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [items],
  );
  const tenantName = items[0]?.tenantName ?? '';

  function updateQuantity(productId: string, quantity: number) {
    const next = items
      .map((item) =>
        item.productId === productId
          ? { ...item, quantity: Math.max(1, Math.min(quantity, Math.max(1, item.stock))) }
          : item,
      )
      .filter((item) => item.quantity > 0);
    setItems(next);
    writeCart(next);
  }

  function removeItem(productId: string) {
    const next = items.filter((item) => item.productId !== productId);
    setItems(next);
    writeCart(next);
  }

  async function requestCode() {
    if (!/^09\d{9}$/.test(phone)) {
      toast.error('شماره موبایل معتبر وارد کنید');
      return;
    }
    setBusy(true);
    try {
      await marketplaceFetch('/otp/request', {
        method: 'POST',
        body: JSON.stringify({ phone }),
      });
      setCodeSent(true);
      toast.success('کد تأیید ارسال شد');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ارسال کد انجام نشد');
    } finally {
      setBusy(false);
    }
  }

  async function checkout() {
    if (items.length === 0) return;
    if (!codeSent) {
      toast.error('اول کد تأیید را دریافت کنید');
      return;
    }
    if (!/^\d{4,8}$/.test(code)) {
      toast.error('کد تأیید را وارد کنید');
      return;
    }
    setBusy(true);
    try {
      const data = await marketplaceFetch<CheckoutResult>('/checkout', {
        method: 'POST',
        body: JSON.stringify({
          tenantSlug: items[0].tenantSlug,
          phone,
          code,
          fullName: fullName.trim() || undefined,
          address: address.trim() || undefined,
          note: note.trim() || undefined,
          items: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
          payOnline: true,
        }),
      });
      setResult(data);
      clearCart();
      setItems([]);
      toast.success(`سفارش ${data.order.number} ثبت شد`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ثبت سفارش انجام نشد');
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return null;

  if (result) {
    return (
      <div className="mx-auto max-w-xl space-y-4 rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-center dark:border-emerald-900 dark:bg-emerald-950/30">
        <ShoppingBag className="mx-auto h-10 w-10 text-emerald-600" />
        <h1 className="text-lg font-black text-emerald-900 dark:text-emerald-100">
          سفارش شما ثبت شد
        </h1>
        <p className="text-sm text-emerald-800 dark:text-emerald-200">
          شمارهٔ سفارش: <b className="nums">{result.order.number}</b> — مبلغ:{' '}
          <b className="nums">{formatToman(result.order.total)}</b>
        </p>
        <p className="text-xs text-emerald-700 dark:text-emerald-300">
          فروشنده: {result.tenant.name}. شمارهٔ سفارش را برای پیگیری نگه دارید.
        </p>
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          {result.payment?.redirectUrl ? (
            <a
              href={result.payment.redirectUrl}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700"
            >
              <CreditCard className="h-4 w-4" />
              پرداخت آنلاین
            </a>
          ) : null}
          <Link
            href="/marketplace/orders"
            className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:border-brand-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            پیگیری سفارش
          </Link>
          <Link
            href="/marketplace/products"
            className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:border-brand-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            ادامهٔ خرید
          </Link>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={ShoppingBag}
        title="سبد خرید خالی است"
        description="از بازارگاه محصولی انتخاب کنید تا اینجا نمایش داده شود."
        action={
          <Link
            href="/marketplace/products"
            className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            دیدن محصولات
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-black text-slate-900 dark:text-slate-100">سبد خرید</h1>
        <p className="mt-1 text-sm text-slate-500">
          سفارش از <b>{tenantName}</b> — هر سبد مخصوص یک کسب‌وکار است.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.productId}
              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
            >
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="h-16 w-16 rounded-xl object-cover"
                />
              ) : (
                <span className="h-16 w-16 rounded-xl bg-slate-100 dark:bg-slate-800" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">
                  {item.name}
                </p>
                <p className="nums mt-1 text-xs text-slate-500">{formatToman(item.price)}</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="کاهش"
                  onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                  className="rounded-lg border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50 dark:border-slate-700"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="nums w-8 text-center text-sm font-bold">{item.quantity}</span>
                <button
                  type="button"
                  aria-label="افزایش"
                  onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                  className="rounded-lg border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50 dark:border-slate-700"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              <button
                type="button"
                aria-label="حذف"
                onClick={() => removeItem(item.productId)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">جمع کالاها</span>
            <span className="nums font-bold">{formatToman(total)}</span>
          </div>
          <p className="rounded-xl bg-slate-50 p-2.5 text-[11px] leading-5 text-slate-500 dark:bg-slate-800/60">
            هزینهٔ ارسال به عهدهٔ فروشنده و پس از هماهنگی است؛ پرداخت آنلاین فعلاً فقط
            بهای کالاها را پوشش می‌دهد.
          </p>

          <label className="block">
            <span className="mb-1 block text-xs text-slate-500">نام و نام خانوادگی (اختیاری)</span>
            <input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-500">شماره موبایل</span>
            <div className="flex gap-2">
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value.replace(/[^\d]/g, ''))}
                dir="ltr"
                placeholder="09xxxxxxxxx"
                className="nums w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-left text-sm dark:border-slate-700 dark:bg-slate-950"
              />
              <button
                type="button"
                onClick={requestCode}
                disabled={busy}
                className="shrink-0 rounded-xl border border-brand-300 px-3 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-60 dark:border-brand-800 dark:text-brand-200"
              >
                {codeSent ? 'ارسال دوباره' : 'ارسال کد'}
              </button>
            </div>
          </label>
          {codeSent ? (
            <label className="block">
              <span className="mb-1 block text-xs text-slate-500">کد تأیید</span>
              <input
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/[^\d]/g, ''))}
                dir="ltr"
                className="nums w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-left text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
          ) : null}
          <label className="block">
            <span className="mb-1 block text-xs text-slate-500">آدرس تحویل (اختیاری)</span>
            <textarea
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              rows={2}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-500">توضیح (اختیاری)</span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={2}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </label>

          <button
            type="button"
            onClick={checkout}
            disabled={busy}
            className="w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? 'در حال ثبت…' : 'ثبت سفارش و پرداخت'}
          </button>
        </div>
      </div>
    </div>
  );
}
