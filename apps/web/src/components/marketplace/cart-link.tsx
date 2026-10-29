'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
import { CART_EVENT, readCart } from '@/lib/marketplace-cart';

export function CartLink() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const sync = () => setCount(readCart().reduce((sum, item) => sum + item.quantity, 0));
    sync();
    window.addEventListener(CART_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(CART_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return (
    <Link
      href="/marketplace/cart"
      className="relative inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-brand-400 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
    >
      <ShoppingBag className="h-4 w-4" />
      سبد خرید
      {count > 0 ? (
        <span className="nums absolute -left-2 -top-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white">
          {count.toLocaleString('fa-IR')}
        </span>
      ) : null}
    </Link>
  );
}
