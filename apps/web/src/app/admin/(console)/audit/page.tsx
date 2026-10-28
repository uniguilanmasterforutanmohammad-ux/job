'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ScrollText } from 'lucide-react';
import { api } from '@/lib/api-client';
import { getAdminToken } from '@/lib/admin-auth';
import { Card, CardBody } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, Td, Th } from '@/components/ui/table';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState, Skeleton } from '@/components/ui/empty-state';
import { formatJalali } from '@/lib/utils';
import type { AdminAuditEntry } from '@/lib/admin-types';
import type { Paginated } from '@/lib/types';

export default function AdminAuditPage() {
  const token = getAdminToken();
  const [tenantId, setTenantId] = useState('');
  const [entity, setEntity] = useState('');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ['admin-audit', { tenantId, entity, action, page }],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: '25' });
      if (tenantId) params.set('tenantId', tenantId);
      if (entity) params.set('entity', entity);
      if (action) params.set('action', action);
      return api.get<Paginated<AdminAuditEntry>>(`/admin/audit?${params}`, token);
    },
  });

  return (
    <div className="space-y-5">
      <PageHeader title="گزارش تغییرات پلتفرم" description="ردیابی کامل اقدامات مدیران روی کسب‌وکارها و ماژول‌ها" />

      <Card>
        <CardBody className="grid gap-3 sm:grid-cols-3">
          <Input
            label="شناسه کسب‌وکار"
            placeholder="UUID"
            dir="ltr"
            className="text-left"
            value={tenantId}
            onChange={(event) => {
              setTenantId(event.target.value.trim());
              setPage(1);
            }}
          />
          <Input
            label="موجودیت"
            placeholder="مثال: tenant, member, tenant_module"
            dir="ltr"
            className="text-left"
            value={entity}
            onChange={(event) => {
              setEntity(event.target.value.trim());
              setPage(1);
            }}
          />
          <Input
            label="اقدام"
            placeholder="مثال: module.grant"
            dir="ltr"
            className="text-left"
            value={action}
            onChange={(event) => {
              setAction(event.target.value.trim());
              setPage(1);
            }}
          />
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
                  <Th>اقدام</Th>
                  <Th>موجودیت</Th>
                  <Th>کسب‌وکار</Th>
                  <Th>مدیر</Th>
                  <Th>IP</Th>
                  <Th>تاریخ</Th>
                </tr>
              </thead>
              <tbody>
                {query.data.data.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <Td>
                      <Badge tone="info">{entry.action}</Badge>
                    </Td>
                    <Td className="nums text-slate-500" dir="ltr">
                      {entry.entity}
                    </Td>
                    <Td>
                      {entry.tenantId ? (
                        <Link
                          href={`/admin/tenants/${entry.tenantId}`}
                          className="text-xs text-brand-600 hover:underline nums"
                          dir="ltr"
                        >
                          {entry.tenantId.slice(0, 8)}…
                        </Link>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </Td>
                    <Td className="text-slate-600 dark:text-slate-300">
                      {entry.platformMember?.fullName ?? 'سیستم'}
                    </Td>
                    <Td className="text-xs text-slate-400 nums" dir="ltr">
                      {entry.ip ?? '—'}
                    </Td>
                    <Td className="text-slate-500">{formatJalali(entry.createdAt, true)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState icon={ScrollText} title="رکوردی یافت نشد" description="فیلترها را تغییر دهید" />
          )}
        </CardBody>
      </Card>

      {query.data && query.data.meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            صفحه {query.data.meta.page} از {query.data.meta.totalPages} — مجموع{' '}
            {query.data.meta.total} رکورد
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              قبلی
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= query.data.meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              بعدی
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
