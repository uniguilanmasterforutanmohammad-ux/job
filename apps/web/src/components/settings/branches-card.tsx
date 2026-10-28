'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Pencil, Plus, Power, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiClientError } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth';
import { useBranchNoun, useEndUserNoun } from '@/lib/use-industry-registry';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { EmptyState, Skeleton } from '@/components/ui/empty-state';

/** One row of `GET /tenant/branches`, with its end-user/staff counts. */
export type BranchRow = {
  id: string;
  name: string;
  code: string | null;
  city: string | null;
  address: string | null;
  phone: string | null;
  isActive: boolean;
  _count: { members: number; customers: number };
};

type BranchForm = {
  name: string;
  code: string;
  city: string;
  address: string;
  phone: string;
};

const EMPTY_FORM: BranchForm = { name: '', code: '', city: '', address: '', phone: '' };

/**
 * Locations of the business — «آموزشگاه» for a language/music school, «شعبه»
 * for everyone else (name comes from the industry registry). Each location
 * shows how many end-users belong to it, e.g. «آموزشگاه یک · ۲۰ زبان‌آموز».
 */
export function BranchesCard() {
  const token = getAccessToken();
  const queryClient = useQueryClient();
  const { noun, plural } = useBranchNoun();
  const endUsers = useEndUserNoun();

  const [editing, setEditing] = useState<BranchRow | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<BranchForm>(EMPTY_FORM);

  const branchesQuery = useQuery({
    queryKey: ['branches'],
    queryFn: () => api.get<BranchRow[]>('/tenant/branches', token),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['branches'] });
    void queryClient.invalidateQueries({ queryKey: ['tenant'] });
  };

  const fail = (error: unknown) =>
    toast.error(error instanceof ApiClientError ? error.message : `خطا در ثبت ${noun}`);

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim() || undefined,
        city: form.city.trim() || undefined,
        address: form.address.trim() || undefined,
        phone: form.phone.trim() || undefined,
      };
      return editing
        ? api.patch<BranchRow>(`/tenant/branches/${editing.id}`, payload, token)
        : api.post<BranchRow>('/tenant/branches', payload, token);
    },
    onSuccess: () => {
      toast.success(editing ? `${noun} ویرایش شد` : `${noun} جدید ثبت شد`);
      setOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      invalidate();
    },
    onError: fail,
  });

  const toggle = useMutation({
    mutationFn: (branch: BranchRow) =>
      api.patch<BranchRow>(`/tenant/branches/${branch.id}`, { isActive: !branch.isActive }, token),
    onSuccess: (branch) => {
      toast.success(branch.isActive ? `${noun} فعال شد` : `${noun} غیرفعال شد`);
      invalidate();
    },
    onError: fail,
  });

  const remove = useMutation({
    mutationFn: (branch: BranchRow) => api.delete(`/tenant/branches/${branch.id}`, token),
    onSuccess: () => {
      toast.success(`${noun} حذف شد`);
      invalidate();
    },
    onError: fail,
  });

  const startCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  };

  const startEdit = (branch: BranchRow) => {
    setEditing(branch);
    setForm({
      name: branch.name,
      code: branch.code ?? '',
      city: branch.city ?? '',
      address: branch.address ?? '',
      phone: branch.phone ?? '',
    });
    setOpen(true);
  };

  const rows = branchesQuery.data ?? [];

  return (
    <Card>
      <CardHeader
        title={plural}
        description={`هر ${noun} کاربران و کارکنان خودش را دارد؛ مثلاً «${noun} یک: ۲۰ ${endUsers.plural}»`}
        action={
          <Button size="sm" onClick={startCreate}>
            <Plus className="h-4 w-4" />
            {noun} جدید
          </Button>
        }
      />
      <CardBody className="space-y-3">
        {branchesQuery.isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Building2}
            title={`${noun}ی ثبت نشده`}
            description={`اگر در چند ${noun} فعالیت می‌کنید، اینجا اضافه کنید تا ${endUsers.plural} هر ${noun} جدا شمرده شوند.`}
            action={
              <Button size="sm" onClick={startCreate}>
                <Plus className="h-4 w-4" />
                {noun} جدید
              </Button>
            }
          />
        ) : (
          rows.map((branch) => (
            <div
              key={branch.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-3 dark:border-slate-800"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Building2 className="h-4 w-4 shrink-0 text-brand-600" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                    {branch.name}
                    {!branch.isActive && (
                      <Badge tone="neutral" className="ms-2">
                        غیرفعال
                      </Badge>
                    )}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    <span className="nums">{branch._count.customers}</span> {endUsers.plural}
                    {' · '}
                    <span className="nums">{branch._count.members}</span> کارمند
                    {branch.city ? ` · ${branch.city}` : ''}
                    {branch.phone ? ` · ${branch.phone}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => startEdit(branch)}
                  aria-label={`ویرایش ${noun}`}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  loading={toggle.isPending}
                  onClick={() => toggle.mutate(branch)}
                  aria-label={branch.isActive ? `غیرفعال‌سازی ${noun}` : `فعال‌سازی ${noun}`}
                >
                  <Power className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (
                      window.confirm(`${noun} «${branch.name}» حذف شود؟ این کار قابل بازگشت است.`)
                    ) {
                      remove.mutate(branch);
                    }
                  }}
                  aria-label={`حذف ${noun}`}
                >
                  <Trash2 className="h-4 w-4 text-rose-500" />
                </Button>
              </div>
            </div>
          ))
        )}
      </CardBody>

      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setEditing(null);
        }}
        title={editing ? `ویرایش ${noun}` : `${noun} جدید`}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false);
                setEditing(null);
              }}
            >
              انصراف
            </Button>
            <Button
              loading={save.isPending}
              disabled={form.name.trim().length < 2}
              onClick={() => save.mutate()}
            >
              {editing ? 'ذخیره تغییرات' : 'ثبت'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            label={`نام ${noun}`}
            placeholder={`${noun} یک`}
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="کد"
              placeholder="A1"
              dir="ltr"
              className="text-left"
              value={form.code}
              onChange={(event) => setForm({ ...form, code: event.target.value })}
            />
            <Input
              label="شهر"
              placeholder="تهران"
              value={form.city}
              onChange={(event) => setForm({ ...form, city: event.target.value })}
            />
          </div>
          <Input
            label="تلفن"
            inputMode="tel"
            placeholder="02112345678"
            dir="ltr"
            className="text-left nums"
            value={form.phone}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
          />
          <Input
            label="نشانی"
            value={form.address}
            onChange={(event) => setForm({ ...form, address: event.target.value })}
          />
        </div>
      </Modal>
    </Card>
  );
}
