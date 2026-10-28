'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiClientError } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth';
import { formatJalali, formatToman } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, Td, Th } from '@/components/ui/table';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState, Skeleton } from '@/components/ui/empty-state';
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONES } from '@/lib/status';
import type { Order, Paginated } from '@/lib/types';

const NEXT_STATUS: Record<string, string> = {
  PENDING: 'CONFIRMED',
  CONFIRMED: 'PREPARING',
  PREPARING: 'SHIPPED',
  SHIPPED: 'DELIVERED',
};

export default function ShopPage() {
  const token = getAccessToken();
  const queryClient = useQueryClient();

  const ordersQuery = useQuery({
    queryKey: ['orders'],
    queryFn: () => api.get<Paginated<Order>>('/shop/orders?pageSize=50', token),
  });

  const advance = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/shop/orders/${id}/status`, { status }, token),
    onSuccess: () => {
      toast.success('وضعیت سفارش به‌روزرسانی شد');
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : 'خطا در تغییر وضعیت'),
  });

  return (
    <div className="space-y-5">
      <PageHeader title="فروش آنلاین" description="سفارش‌ها، پیگیری ارسال و برگه سفارش" />

      <Card>
        <CardHeader title="سفارش‌ها" />
        <CardBody className="p-0">
          {ordersQuery.isLoading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : ordersQuery.data && ordersQuery.data.data.length > 0 ? (
            <Table>
              <thead>
                <tr>
                  <Th>شماره</Th>
                  <Th>اقلام</Th>
                  <Th>مبلغ کل</Th>
                  <Th>تاریخ</Th>
                  <Th>وضعیت</Th>
                  <Th>عملیات</Th>
                </tr>
              </thead>
              <tbody>
                {ordersQuery.data.data.map((order) => (
                  <tr key={order.id}>
                    <Td className="font-medium nums">{order.number}</Td>
                    <Td className="nums">{order.items.length} قلم</Td>
                    <Td className="nums">{formatToman(order.total)}</Td>
                    <Td className="nums">{formatJalali(order.createdAt)}</Td>
                    <Td>
                      <Badge tone={ORDER_STATUS_TONES[order.status]}>
                        {ORDER_STATUS_LABELS[order.status]}
                      </Badge>
                    </Td>
                    <Td>
                      {NEXT_STATUS[order.status] ? (
                        <Button
                          size="sm"
                          loading={advance.isPending}
                          onClick={() => advance.mutate({ id: order.id, status: NEXT_STATUS[order.status]! })}
                        >
                          → {ORDER_STATUS_LABELS[NEXT_STATUS[order.status]!]}
                        </Button>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState
              icon={ShoppingBag}
              title="سفارشی ثبت نشده است"
              description="سفارش‌های ثبت‌شده از اپ/فروشگاه اینجا نمایش داده می‌شوند."
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
