'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Package, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiClientError } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth';
import { formatNumber, formatToman } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, Td, Th } from '@/components/ui/table';
import { Modal } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState, Skeleton } from '@/components/ui/empty-state';
import type { Paginated, Product } from '@/lib/types';

type LowStockRow = {
  id: string;
  name: string;
  stock: string;
  minStock: string;
  suggestedOrder: number;
};

export default function InventoryPage() {
  const token = getAccessToken();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [form, setForm] = useState({ name: '', sku: '', costPrice: '0', salePrice: '0', minStock: '0' });
  const [movement, setMovement] = useState({ productId: '', type: 'PURCHASE', quantity: '1' });

  const productsQuery = useQuery({
    queryKey: ['products'],
    queryFn: () => api.get<Paginated<Product>>('/inventory/products?pageSize=50', token),
  });

  const lowStockQuery = useQuery({
    queryKey: ['low-stock'],
    queryFn: () => api.get<LowStockRow[]>('/inventory/products/low-stock', token),
  });

  const createProduct = useMutation({
    mutationFn: () =>
      api.post(
        '/inventory/products',
        {
          name: form.name,
          sku: form.sku || undefined,
          costPrice: Number(form.costPrice),
          salePrice: Number(form.salePrice),
          minStock: Number(form.minStock),
        },
        token,
      ),
    onSuccess: () => {
      toast.success('کالا ثبت شد');
      setOpen(false);
      setForm({ name: '', sku: '', costPrice: '0', salePrice: '0', minStock: '0' });
      void queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : 'خطا در ثبت کالا'),
  });

  const createMovement = useMutation({
    mutationFn: () =>
      api.post(
        '/inventory/movements',
        {
          productId: movement.productId,
          type: movement.type,
          quantity: Number(movement.quantity),
        },
        token,
      ),
    onSuccess: () => {
      toast.success('سند انبار ثبت شد');
      setMoveOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      void queryClient.invalidateQueries({ queryKey: ['low-stock'] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : 'خطا در ثبت سند'),
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="موجودی و انبار"
        description="کالا، سند ورود/خروج، حداقل موجودی و بارکد"
        action={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setMovement({ productId: productsQuery.data?.data[0]?.id ?? '', type: 'PURCHASE', quantity: '1' });
                setMoveOpen(true);
              }}
              disabled={!productsQuery.data?.data.length}
            >
              ثبت سند انبار
            </Button>
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" />
              کالای جدید
            </Button>
          </div>
        }
      />

      {lowStockQuery.data && lowStockQuery.data.length > 0 && (
        <Card>
          <CardHeader
            title="هشدار حداقل موجودی"
            action={<Badge tone="warning">{formatNumber(lowStockQuery.data.length)} کالا</Badge>}
          />
          <CardBody className="flex flex-wrap gap-2">
            {lowStockQuery.data.map((row) => (
              <div
                key={row.id}
                className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm dark:bg-amber-950/40"
              >
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span className="text-amber-800 dark:text-amber-200">{row.name}</span>
                <span className="nums text-xs text-amber-600">
                  {formatNumber(row.stock)} / {formatNumber(row.minStock)}
                </span>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title="فهرست کالاها" />
        <CardBody className="p-0">
          {productsQuery.isLoading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : productsQuery.data && productsQuery.data.data.length > 0 ? (
            <Table>
              <thead>
                <tr>
                  <Th>نام</Th>
                  <Th>کد</Th>
                  <Th>دسته</Th>
                  <Th>قیمت فروش</Th>
                  <Th>موجودی</Th>
                  <Th>وضعیت</Th>
                </tr>
              </thead>
              <tbody>
                {productsQuery.data.data.map((p) => (
                  <tr key={p.id}>
                    <Td className="font-medium">{p.name}</Td>
                    <Td className="nums">{p.sku ?? '—'}</Td>
                    <Td>{p.category ?? '—'}</Td>
                    <Td className="nums">{formatToman(p.salePrice)}</Td>
                    <Td className="nums">
                      {formatNumber(p.stock)} {p.unit}
                    </Td>
                    <Td>
                      {p.lowStock ? <Badge tone="warning">کمبود</Badge> : <Badge tone="success">موجود</Badge>}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState
              icon={Package}
              title="کالایی ثبت نشده است"
              description="برای پیگیری موجودی، اولین کالا را اضافه کنید."
              action={
                <Button onClick={() => setOpen(true)}>
                  <Plus className="h-4 w-4" />
                  کالای جدید
                </Button>
              }
            />
          )}
        </CardBody>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="ثبت کالای جدید"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              انصراف
            </Button>
            <Button
              loading={createProduct.isPending}
              disabled={form.name.trim().length < 2}
              onClick={() => createProduct.mutate()}
            >
              ثبت
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="نام کالا"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            label="کد کالا (SKU)"
            dir="ltr"
            className="text-left"
            value={form.sku}
            onChange={(e) => setForm({ ...form, sku: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="قیمت خرید"
              dir="ltr"
              className="text-left nums"
              value={form.costPrice}
              onChange={(e) => setForm({ ...form, costPrice: e.target.value.replace(/\D/g, '') })}
            />
            <Input
              label="قیمت فروش"
              dir="ltr"
              className="text-left nums"
              value={form.salePrice}
              onChange={(e) => setForm({ ...form, salePrice: e.target.value.replace(/\D/g, '') })}
            />
          </div>
          <Input
            label="حداقل موجودی"
            dir="ltr"
            className="text-left nums"
            value={form.minStock}
            onChange={(e) => setForm({ ...form, minStock: e.target.value.replace(/\D/g, '') })}
          />
        </div>
      </Modal>

      <Modal
        open={moveOpen}
        onClose={() => setMoveOpen(false)}
        title="ثبت سند انبار"
        footer={
          <>
            <Button variant="outline" onClick={() => setMoveOpen(false)}>
              انصراف
            </Button>
            <Button loading={createMovement.isPending} onClick={() => createMovement.mutate()}>
              ثبت
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="کالا"
            value={movement.productId}
            onChange={(e) => setMovement({ ...movement, productId: e.target.value })}
          >
            {productsQuery.data?.data.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Select
            label="نوع سند"
            value={movement.type}
            onChange={(e) => setMovement({ ...movement, type: e.target.value })}
          >
            <option value="PURCHASE">خرید</option>
            <option value="SALE">فروش</option>
            <option value="CONSUMPTION">مصرف</option>
            <option value="WASTE">ضایعات</option>
          </Select>
          <Input
            label="مقدار"
            dir="ltr"
            className="text-left nums"
            value={movement.quantity}
            onChange={(e) => setMovement({ ...movement, quantity: e.target.value.replace(/[^\d.]/g, '') })}
          />
        </div>
      </Modal>
    </div>
  );
}
