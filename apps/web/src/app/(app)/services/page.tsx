'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, Plus, Sparkles, Store } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiClientError } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth';
import { formatToman } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, Td, Th } from '@/components/ui/table';
import { Modal } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState, Skeleton } from '@/components/ui/empty-state';

type ServiceRow = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  imageUrl: string | null;
  durationMinutes: number;
  price: string;
  isActive: boolean;
  isPublic: boolean;
};

const EMPTY_FORM = {
  name: '',
  description: '',
  category: '',
  imageUrl: '',
  durationMinutes: '60',
  price: '0',
  isPublic: false,
};

export default function ServicesPage() {
  const token = getAccessToken();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const servicesQuery = useQuery({
    queryKey: ['services'],
    queryFn: () => api.get<ServiceRow[]>('/scheduling/services', token),
  });

  const createService = useMutation({
    mutationFn: () =>
      api.post(
        '/scheduling/services',
        {
          name: form.name,
          description: form.description || undefined,
          category: form.category || undefined,
          imageUrl: form.imageUrl || undefined,
          durationMinutes: Number(form.durationMinutes) || 60,
          price: Number(form.price) || 0,
          isPublic: form.isPublic,
        },
        token,
      ),
    onSuccess: () => {
      toast.success('خدمت ثبت شد');
      setOpen(false);
      setForm(EMPTY_FORM);
      void queryClient.invalidateQueries({ queryKey: ['services'] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : 'خطا در ثبت خدمت'),
  });

  const togglePublish = useMutation({
    mutationFn: ({ id, isPublic }: { id: string; isPublic: boolean }) =>
      api.patch(`/scheduling/services/${id}`, { isPublic }, token),
    onSuccess: (_data, variables) => {
      toast.success(variables.isPublic ? 'خدمت در بازارگاه منتشر شد' : 'خدمت از بازارگاه برداشته شد');
      void queryClient.invalidateQueries({ queryKey: ['services'] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : 'خطا در انتشار خدمت'),
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="خدمات"
        description="کلاس‌ها و خدمات قابل ارائه؛ موارد منتشرشده در بازارگاه دیده می‌شوند"
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            خدمت جدید
          </Button>
        }
      />

      <Card>
        <CardHeader title="فهرست خدمات" />
        <CardBody className="p-0">
          {servicesQuery.isLoading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : servicesQuery.data && servicesQuery.data.length > 0 ? (
            <Table>
              <thead>
                <tr>
                  <Th>نام</Th>
                  <Th>دسته</Th>
                  <Th>مدت</Th>
                  <Th>قیمت</Th>
                  <Th>وضعیت</Th>
                  <Th>بازارگاه</Th>
                </tr>
              </thead>
              <tbody>
                {servicesQuery.data.map((service) => (
                  <tr key={service.id}>
                    <Td className="font-medium">{service.name}</Td>
                    <Td>{service.category ?? '—'}</Td>
                    <Td className="nums inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      {service.durationMinutes} دقیقه
                    </Td>
                    <Td className="nums">{formatToman(service.price)}</Td>
                    <Td>
                      {service.isActive ? (
                        <Badge tone="success">فعال</Badge>
                      ) : (
                        <Badge tone="neutral">غیرفعال</Badge>
                      )}
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            togglePublish.mutate({ id: service.id, isPublic: !service.isPublic })
                          }
                          className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium ${
                            service.isPublic
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200'
                              : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                        >
                          <Store className="h-3.5 w-3.5" />
                          {service.isPublic ? 'منتشرشده' : 'منتشر نشده'}
                        </button>
                        {service.isPublic ? (
                          <a
                            href={`/marketplace/services/${service.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-brand-600 hover:text-brand-700"
                          >
                            مشاهده
                          </a>
                        ) : null}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState
              icon={Sparkles}
              title="خدمتی ثبت نشده است"
              description="اولین کلاس یا خدمت را اضافه کنید تا در نوبت‌دهی و بازارگاه استفاده شود."
              action={
                <Button onClick={() => setOpen(true)}>
                  <Plus className="h-4 w-4" />
                  خدمت جدید
                </Button>
              }
            />
          )}
        </CardBody>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="ثبت خدمت جدید"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              انصراف
            </Button>
            <Button
              loading={createService.isPending}
              disabled={form.name.trim().length < 2}
              onClick={() => createService.mutate()}
            >
              ثبت
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="نام خدمت"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
          <Input
            label="دسته (برای فیلتر بازارگاه)"
            value={form.category}
            onChange={(event) => setForm({ ...form, category: event.target.value })}
          />
          <Input
            label="آدرس تصویر"
            dir="ltr"
            className="text-left"
            placeholder="/marketplace/service-fitness.svg"
            value={form.imageUrl}
            onChange={(event) => setForm({ ...form, imageUrl: event.target.value })}
          />
          <Input
            label="توضیح"
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="مدت (دقیقه)"
              dir="ltr"
              className="text-left nums"
              value={form.durationMinutes}
              onChange={(event) =>
                setForm({ ...form, durationMinutes: event.target.value.replace(/\D/g, '') })
              }
            />
            <Input
              label="قیمت (تومان)"
              dir="ltr"
              className="text-left nums"
              value={form.price}
              onChange={(event) => setForm({ ...form, price: event.target.value.replace(/\D/g, '') })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={form.isPublic}
              onChange={(event) => setForm({ ...form, isPublic: event.target.checked })}
              className="h-4 w-4 rounded border-slate-300"
            />
            انتشار در بازارگاه
          </label>
        </div>
      </Modal>
    </div>
  );
}
