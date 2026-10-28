'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Building2, Users, Activity, Layers, ShoppingBag, Boxes } from 'lucide-react';
import { api } from '@/lib/api-client';
import { getAdminToken } from '@/lib/admin-auth';
import { industryLabel } from '@repo/shared';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/admin/status-badge';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/empty-state';
import { Table, Td, Th } from '@/components/ui/table';
import { formatJalali, formatNumber } from '@/lib/utils';
import type { AdminIndustry, AdminStats } from '@/lib/admin-types';

export default function AdminDashboardPage() {
  const token = getAdminToken();
  const industriesQuery = useQuery({
    queryKey: ['admin-industries'],
    queryFn: () => api.get<AdminIndustry[]>('/admin/industries', token),
  });
  const industryLabels = new Map(
    (industriesQuery.data ?? []).map((item) => [item.key, item.label]),
  );
  const statsQuery = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.get<AdminStats>('/admin/stats', token),
  });

  const stats = statsQuery.data;

  const cards = [
    { label: 'کسب‌وکارها', value: stats?.tenants, icon: Building2, tone: 'brand' as const },
    { label: 'کسب‌وکارهای فعال', value: stats?.activeTenants, icon: Activity, tone: 'success' as const },
    { label: 'کاربران پنل‌ها', value: stats?.members, icon: Users, tone: 'info' as const },
    { label: 'مشتریان نهایی', value: stats?.customers, icon: ShoppingBag, tone: 'neutral' as const },
    { label: 'ماژول‌های فعال', value: stats?.modulesEnabled, icon: Layers, tone: 'warning' as const },
    { label: 'کسب‌وکارهای غیرفعال', value: stats?.suspended, icon: Boxes, tone: 'danger' as const },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="داشبورد پلتفرم" description="نمای کلی وضعیت کسب‌وکارها و ماژول‌ها" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label}>
              <CardBody className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">{card.label}</p>
                  {statsQuery.isLoading ? (
                    <Skeleton className="mt-2 h-7 w-16" />
                  ) : (
                    <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100 nums">
                      {formatNumber(card.value ?? 0)}
                    </p>
                  )}
                </div>
                <Badge tone={card.tone} className="p-2.5">
                  <Icon className="h-5 w-5" />
                </Badge>
              </CardBody>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="توزیع صنعت" description="کسب‌وکارها به تفکیک حوزه" />
          <CardBody className="space-y-3">
            {statsQuery.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : stats && stats.byIndustry.length > 0 ? (
              stats.byIndustry.map((row) => {
                const percent = stats.tenants ? Math.round((row.count / stats.tenants) * 100) : 0;
                return (
                  <div key={row.industry}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-300">
                        {industryLabels.get(row.industry) ?? industryLabel(row.industry)}
                      </span>
                      <span className="text-slate-500 nums">
                        {formatNumber(row.count)} ({percent}٪)
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className="h-full rounded-full bg-brand-500" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="py-6 text-center text-sm text-slate-500">داده‌ای موجود نیست</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="جدیدترین کسب‌وکارها"
            action={
              <Link href="/admin/tenants" className="text-sm text-brand-600 hover:underline">
                مشاهده همه
              </Link>
            }
          />
          <CardBody className="p-0">
            <Table>
              <thead>
                <tr>
                  <Th>نام</Th>
                  <Th>وضعیت</Th>
                  <Th>تاریخ ایجاد</Th>
                </tr>
              </thead>
              <tbody>
                {statsQuery.isLoading ? (
                  <tr>
                    <Td colSpan={3}>
                      <Skeleton className="h-16 w-full" />
                    </Td>
                  </tr>
                ) : (
                  stats?.recentTenants.map((tenant) => (
                    <tr key={tenant.id}>
                      <Td>
                        <Link
                          href={`/admin/tenants/${tenant.id}`}
                          className="font-medium text-brand-600 hover:underline"
                        >
                          {tenant.name}
                        </Link>
                      </Td>
                      <Td>
                        <StatusBadge status={tenant.status} />
                      </Td>
                      <Td className="text-slate-500">{formatJalali(tenant.createdAt)}</Td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
