'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Ban, Building2, Check, Package, ShoppingCart, Star, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiClientError } from '@/lib/api-client';
import { getAdminToken, isAtLeast, useAdminAuth } from '@/lib/admin-auth';
import { formatJalali, formatToman, formatNumber } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState, Skeleton } from '@/components/ui/empty-state';

type Overview = {
  businesses: number;
  products: number;
  services: number;
  ordersLast30Days: number;
  gmvLast30Days: number;
  pendingReviews: number;
  publishedReviews: number;
};

type MarketplaceBusiness = {
  id: string;
  slug: string;
  name: string;
  industry: string;
  city: string | null;
  status: string;
  marketplaceEnabled: boolean;
  publishedProducts: number;
  publishedServices: number;
  orders: number;
};

type Review = {
  id: string;
  rating: number;
  comment: string | null;
  isPublic: boolean;
  isVerified: boolean;
  createdAt: string;
  tenant: { id: string; name: string; slug: string };
  customer: { fullName: string; phone: string | null } | null;
  product: { id: string; name: string } | null;
  service: { id: string; name: string } | null;
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'فعال',
  SUSPENDED: 'تعلیق',
  ARCHIVED: 'بایگانی',
};

export default function AdminMarketplacePage() {
  const token = getAdminToken();
  const queryClient = useQueryClient();
  const { operator } = useAdminAuth();
  const canEdit = isAtLeast(operator?.role, 'ADMIN');
  const [search, setSearch] = useState('');
  const [reviewStatus, setReviewStatus] = useState<'pending' | 'published'>('pending');

  const overview = useQuery({
    queryKey: ['admin-marketplace-overview'],
    queryFn: () => api.get<Overview>('/admin/marketplace/overview', token),
  });
  const businesses = useQuery({
    queryKey: ['admin-marketplace-businesses', search],
    queryFn: () =>
      api.get<MarketplaceBusiness[]>(
        `/admin/marketplace/businesses?search=${encodeURIComponent(search)}`,
        token,
      ),
  });
  const reviews = useQuery({
    queryKey: ['admin-marketplace-reviews', reviewStatus],
    queryFn: () =>
      api.get<Review[]>(`/admin/marketplace/reviews?status=${reviewStatus}`, token),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin-marketplace-overview'] });
    void queryClient.invalidateQueries({ queryKey: ['admin-marketplace-businesses'] });
    void queryClient.invalidateQueries({ queryKey: ['admin-marketplace-reviews'] });
  };

  const toggleBusiness = useMutation({
    mutationFn: ({ id, marketplaceEnabled }: { id: string; marketplaceEnabled: boolean }) =>
      api.patch(`/admin/marketplace/businesses/${id}`, { marketplaceEnabled }, token),
    onSuccess: () => {
      toast.success('وضعیت انتشار بازارگاه به‌روز شد');
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : 'به‌روزرسانی انجام نشد'),
  });

  const moderate = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      api.patch(`/admin/marketplace/reviews/${id}`, { approve }, token),
    onSuccess: (_data, variables) => {
      toast.success(variables.approve ? 'نظر تأیید و منتشر شد' : 'نظر رد شد');
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : 'بررسی نظر انجام نشد'),
  });

  const stats = overview.data;

  return (
    <div className="space-y-5">
      <PageHeader
        title="بازارگاه"
        description="نظارت بر ویترین اصناف، سفارش‌ها و صف بررسی نظرات"
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { icon: Building2, label: 'کسب‌وکارهای عضو', value: stats?.businesses },
          { icon: Package, label: 'کالاهای منتشرشده', value: stats?.products },
          { icon: ShoppingCart, label: 'سفارش ۳۰ روز', value: stats?.ordersLast30Days },
          { icon: Star, label: 'نظر در انتظار تأیید', value: stats?.pendingReviews },
        ].map((item) => (
          <Card key={item.label}>
            <CardBody className="flex items-center gap-3">
              <span className="rounded-xl bg-brand-50 p-2.5 text-brand-600 dark:bg-brand-900/30">
                <item.icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs text-slate-500">{item.label}</p>
                <p className="text-lg font-black nums">{formatNumber(item.value ?? 0)}</p>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <Card>
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <Wallet className="h-4 w-4 text-emerald-600" />
            گردش مالی ۳۰ روز:
            <b className="nums">{formatToman(stats?.gmvLast30Days ?? 0)}</b>
          </p>
          <p className="text-xs text-slate-500">
            نظرات منتشرشده: <b className="nums">{formatNumber(stats?.publishedReviews ?? 0)}</b>
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="کسب‌وکارها"
          description="انتشار در بازارگاه را می‌توانید برای هر کسب‌وکار قطع یا وصل کنید"
          action={
            <Input
              placeholder="جست‌وجوی نام، شناسه یا شهر"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-56"
            />
          }
        />
        <CardBody className="space-y-2">
          {businesses.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : businesses.data?.length ? (
            businesses.data.map((business) => (
              <div
                key={business.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 p-3 dark:border-slate-800"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
                    {business.name}
                    <Badge tone={business.marketplaceEnabled ? 'success' : 'neutral'}>
                      {business.marketplaceEnabled ? 'منتشر' : 'خارج از بازارگاه'}
                    </Badge>
                    {business.status !== 'ACTIVE' ? (
                      <Badge tone="danger">{STATUS_LABELS[business.status] ?? business.status}</Badge>
                    ) : null}
                  </p>
                  <p className="nums mt-0.5 text-xs text-slate-500">
                    {business.slug}
                    {business.city ? ` • ${business.city}` : ''} — {formatNumber(business.orders)}{' '}
                    سفارش، {formatNumber(business.publishedProducts)} کالا،{' '}
                    {formatNumber(business.publishedServices)} خدمت
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!canEdit || toggleBusiness.isPending}
                  onClick={() =>
                    toggleBusiness.mutate({
                      id: business.id,
                      marketplaceEnabled: !business.marketplaceEnabled,
                    })
                  }
                >
                  {business.marketplaceEnabled ? (
                    <>
                      <Ban className="h-4 w-4 text-rose-500" />
                      حذف از بازارگاه
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 text-emerald-600" />
                      افزودن به بازارگاه
                    </>
                  )}
                </Button>
              </div>
            ))
          ) : (
            <EmptyState title="کسب‌وکاری پیدا نشد" />
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="صف بررسی نظرات"
          description="نظرات بدون خرید تأییدشده پس از تأیید شما در صفحهٔ محصول دیده می‌شوند"
          action={
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={reviewStatus === 'pending' ? 'primary' : 'ghost'}
                onClick={() => setReviewStatus('pending')}
              >
                در انتظار
              </Button>
              <Button
                size="sm"
                variant={reviewStatus === 'published' ? 'primary' : 'ghost'}
                onClick={() => setReviewStatus('published')}
              >
                منتشرشده
              </Button>
            </div>
          }
        />
        <CardBody className="space-y-2">
          {reviews.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : reviews.data?.length ? (
            reviews.data.map((review) => (
              <div
                key={review.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-3 dark:border-slate-800"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-100">
                    <span className="nums" dir="ltr">
                      {'★'.repeat(review.rating)}
                      <span className="text-slate-300">{'★'.repeat(5 - review.rating)}</span>
                    </span>
                    {review.product?.name ?? review.service?.name ?? 'بدون آیتم'}
                    <span className="text-xs text-slate-400">— {review.tenant.name}</span>
                    {review.isVerified ? (
                      <Badge tone="success">
                        <BadgeCheck className="h-3 w-3" /> خرید تأییدشده
                      </Badge>
                    ) : null}
                  </p>
                  {review.comment ? (
                    <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
                      {review.comment}
                    </p>
                  ) : null}
                  <p className="mt-1 text-[11px] text-slate-400">
                    {review.customer?.fullName ?? 'مشتری'} — {formatJalali(review.createdAt, true)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {!review.isPublic ? (
                    <Button
                      size="sm"
                      disabled={!canEdit || moderate.isPending}
                      onClick={() => moderate.mutate({ id: review.id, approve: true })}
                    >
                      تأیید و انتشار
                    </Button>
                  ) : null}
                  {review.isPublic ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={!canEdit || moderate.isPending}
                      onClick={() => moderate.mutate({ id: review.id, approve: false })}
                    >
                      برداشتن
                    </Button>
                  ) : null}
                </div>
              </div>
            ))
          ) : (
            <EmptyState
              title={reviewStatus === 'pending' ? 'صف بررسی خالی است' : 'نظری منتشر نشده'}
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
