'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Search, Building2, Plus } from 'lucide-react';
import { api } from '@/lib/api-client';
import { getAdminToken } from '@/lib/admin-auth';
import { Card, CardBody } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Table, Td, Th } from '@/components/ui/table';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState, Skeleton } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/admin/status-badge';
import { CreateTenantDialog } from '@/components/admin/create-tenant-dialog';
import { TenantModulesCell, TenantStatusToggle } from '@/components/admin/tenant-list-actions';
import { formatJalali, formatNumber } from '@/lib/utils';
import type { AdminTenantSummary } from '@/lib/admin-types';
import type { Paginated } from '@/lib/types';

const INDUSTRIES = [
  'SPORTS_COACHING',
  'LANGUAGE_SCHOOL',
  'BEAUTY',
  'HEALTHCARE',
  'ART_MUSIC',
  'EARLY_CHILD',
  'PSYCHOLOGY',
  'LEGAL',
  'MEDIA_PHOTO',
  'TECHNOLOGY',
  'RESTAURANT_CAFE',
  'RETAIL',
  'TECHNICAL_SERVICES',
  'REAL_ESTATE',
  'TRANSPORT',
  'TOURISM',
  'BUSINESS_CONSULTING',
  'OTHER',
];

export default function AdminTenantsPage() {
  const token = getAdminToken();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [industry, setIndustry] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);

  const query = useQuery({
    queryKey: ['admin-tenants', { search, status, industry, page }],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (search) params.set('search', search);
      if (status) params.set('status', status);
      if (industry) params.set('industry', industry);
      return api.get<Paginated<AdminTenantSummary>>(`/admin/tenants?${params}`, token);
    },
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="کسب‌وکارها"
        description="مدیریت، ویرایش و کنترل دسترسی ماژول‌های هر کسب‌وکار"
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            کسب‌وکار جدید
          </Button>
        }
      />

      <CreateTenantDialog open={createOpen} onClose={() => setCreateOpen(false)} />

      <Card>
        <CardBody className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            label="جستجو"
            placeholder="نام، اسلاگ، تلفن یا ایمیل"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
          <Select
            label="وضعیت"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="">همه</option>
            <option value="ACTIVE">فعال</option>
            <option value="SUSPENDED">غیرفعال</option>
            <option value="ARCHIVED">آرشیو</option>
          </Select>
          <Select
            label="صنعت"
            value={industry}
            onChange={(event) => {
              setIndustry(event.target.value);
              setPage(1);
            }}
          >
            <option value="">همه</option>
            {INDUSTRIES.map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </Select>
          <div className="flex items-end">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setSearch('');
                setStatus('');
                setIndustry('');
                setPage(1);
              }}
            >
              <Search className="h-4 w-4" />
              پاک‌سازی فیلترها
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="p-0">
          {query.isLoading ? (
            <div className="space-y-2 p-5">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : query.data && query.data.data.length > 0 ? (
            <Table>
              <thead>
                <tr>
                  <Th>نام کسب‌وکار</Th>
                  <Th>صنعت</Th>
                  <Th>وضعیت</Th>
                  <Th>پلن</Th>
                  <Th>ماژول‌ها</Th>
                  <Th>کاربران</Th>
                  <Th>مشتریان</Th>
                  <Th>تاریخ ایجاد</Th>
                  <Th>اقدام</Th>
                </tr>
              </thead>
              <tbody>
                {query.data.data.map((tenant) => (
                  <tr key={tenant.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <Td>
                      <p className="font-medium text-slate-900 dark:text-slate-100">{tenant.name}</p>
                      <p className="text-xs text-slate-400 nums" dir="ltr">
                        {tenant.slug}
                      </p>
                    </Td>
                    <Td className="text-slate-500">{tenant.industry}</Td>
                    <Td>
                      <StatusBadge status={tenant.status} />
                    </Td>
                    <Td className="text-slate-500">
                      {tenant.subscription?.plan?.name ?? '—'}
                      {tenant.subscription && (
                        <span className="ms-1 text-xs">
                          <StatusBadge status={tenant.subscription.status} />
                        </span>
                      )}
                    </Td>
                    <Td>
                      <TenantModulesCell tenant={tenant} />
                    </Td>
                    <Td className="nums">{formatNumber(tenant._count.members)}</Td>
                    <Td className="nums">{formatNumber(tenant._count.customers)}</Td>
                    <Td className="text-slate-500">{formatJalali(tenant.createdAt)}</Td>
                    <Td>
                      <div className="flex flex-col items-start gap-2">
                        <Link
                          href={`/admin/tenants/${tenant.id}`}
                          className="text-brand-600 hover:underline"
                        >
                          مدیریت
                        </Link>
                        <TenantStatusToggle tenant={tenant} />
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState
              icon={Building2}
              title="کسب‌وکاری یافت نشد"
              description="فیلترها را تغییر دهید یا کسب‌وکار جدیدی ثبت شود"
            />
          )}
        </CardBody>
      </Card>

      {query.data && query.data.meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            صفحه {formatNumber(query.data.meta.page)} از {formatNumber(query.data.meta.totalPages)}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              قبلی
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= query.data.meta.totalPages}
              onClick={() => setPage((prev) => prev + 1)}
            >
              بعدی
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
