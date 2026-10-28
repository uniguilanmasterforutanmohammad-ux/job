'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Plus, ShieldCheck, Trash2, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiClientError } from '@/lib/api-client';
import { getAdminToken, useAdminAuth } from '@/lib/admin-auth';
import { formatJalali } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardBody } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, Td, Th } from '@/components/ui/table';
import { Modal } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState, Skeleton } from '@/components/ui/empty-state';
import type { AdminTeamMember } from '@/lib/admin-types';
import type { Paginated } from '@/lib/types';

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'مدیر ارشد',
  ADMIN: 'مدیر پلتفرم',
  SUPPORT: 'پشتیبانی',
};

const emptyForm = { phone: '', fullName: '', email: '', role: 'ADMIN', password: '' };

export default function AdminTeamPage() {
  const token = getAdminToken();
  const queryClient = useQueryClient();
  const { operator } = useAdminAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const query = useQuery({
    queryKey: ['admin-team'],
    queryFn: () => api.get<Paginated<AdminTeamMember>>('/admin/team?pageSize=50', token),
  });

  const create = useMutation({
    mutationFn: () =>
      api.post(
        '/admin/team',
        {
          phone: form.phone,
          fullName: form.fullName,
          email: form.email || undefined,
          role: form.role,
          password: form.password,
        },
        token,
      ),
    onSuccess: () => {
      toast.success('مدیر پلتفرم ایجاد شد');
      setOpen(false);
      setForm(emptyForm);
      void queryClient.invalidateQueries({ queryKey: ['admin-team'] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : 'خطا در ایجاد مدیر'),
  });

  const toggleStatus = useMutation({
    mutationFn: (member: AdminTeamMember) =>
      api.patch(
        `/admin/team/${member.id}`,
        { status: member.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' },
        token,
      ),
    onSuccess: () => {
      toast.success('وضعیت مدیر تغییر کرد');
      void queryClient.invalidateQueries({ queryKey: ['admin-team'] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : 'خطا در تغییر وضعیت'),
  });

  const remove = useMutation({
    mutationFn: (memberId: string) => api.delete(`/admin/team/${memberId}`, token),
    onSuccess: () => {
      toast.success('مدیر حذف شد');
      void queryClient.invalidateQueries({ queryKey: ['admin-team'] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : 'خطا در حذف مدیر'),
  });

  const revokeSessions = useMutation({
    mutationFn: (memberId: string) => api.post(`/admin/team/${memberId}/revoke-sessions`, {}, token),
    onSuccess: () => toast.success('نشست‌های مدیر بسته شد'),
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : 'خطا در بستن نشست‌ها'),
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="مدیران پلتفرم"
        description="مدیریت حساب‌های دسترسی به بنل ادمین کل"
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            مدیر جدید
          </Button>
        }
      />

      <Card>
        <CardBody className="p-0">
          {query.isLoading ? (
            <div className="space-y-2 p-5">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : query.data && query.data.data.length > 0 ? (
            <Table>
              <thead>
                <tr>
                  <Th>نام</Th>
                  <Th>موبایل</Th>
                  <Th>ایمیل</Th>
                  <Th>نقش</Th>
                  <Th>وضعیت</Th>
                  <Th>آخرین ورود</Th>
                  <Th>عملیات</Th>
                </tr>
              </thead>
              <tbody>
                {query.data.data.map((member) => (
                  <tr key={member.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <Td className="font-medium text-slate-900 dark:text-slate-100">
                      {member.fullName}
                      {member.id === operator?.platformMemberId && (
                        <Badge tone="brand" className="ms-2">
                          شما
                        </Badge>
                      )}
                    </Td>
                    <Td className="nums" dir="ltr">
                      {member.phone}
                    </Td>
                    <Td className="text-slate-500" dir="ltr">
                      {member.email ?? '—'}
                    </Td>
                    <Td>
                      <Badge tone={member.role === 'SUPER_ADMIN' ? 'brand' : 'info'}>
                        {ROLE_LABELS[member.role] ?? member.role}
                      </Badge>
                    </Td>
                    <Td>
                      {member.status === 'ACTIVE' ? (
                        <Badge tone="success">فعال</Badge>
                      ) : (
                        <Badge tone="danger">غیرفعال</Badge>
                      )}
                    </Td>
                    <Td className="text-slate-500">{formatJalali(member.lastLoginAt, true)}</Td>
                    <Td>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title={member.status === 'ACTIVE' ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
                          onClick={() => toggleStatus.mutate(member)}
                        >
                          <UserX className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="بستن نشست‌ها"
                          onClick={() => revokeSessions.mutate(member.id)}
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="حذف"
                          disabled={member.id === operator?.platformMemberId}
                          onClick={() => {
                            if (confirm(`${member.fullName} حذف شود؟`)) remove.mutate(member.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState icon={ShieldCheck} title="مدیری وجود ندارد" />
          )}
        </CardBody>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="ایجاد مدیر پلتفرم"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              انصراف
            </Button>
            <Button
              loading={create.isPending}
              disabled={!/^09\d{9}$/.test(form.phone) || form.password.length < 8}
              onClick={() => create.mutate()}
            >
              ایجاد
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="نام کامل"
            value={form.fullName}
            onChange={(event) => setForm({ ...form, fullName: event.target.value })}
          />
          <Input
            label="موبایل"
            dir="ltr"
            className="text-left nums"
            value={form.phone}
            onChange={(event) =>
              setForm({ ...form, phone: event.target.value.replace(/\D/g, '').slice(0, 11) })
            }
          />
          <Input
            label="ایمیل"
            dir="ltr"
            className="text-left"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
          />
          <Select
            label="نقش"
            value={form.role}
            onChange={(event) => setForm({ ...form, role: event.target.value })}
          >
            <option value="SUPPORT">پشتیبانی</option>
            <option value="ADMIN">مدیر پلتفرم</option>
            <option value="SUPER_ADMIN">مدیر ارشد</option>
          </Select>
          <Input
            label="رمز عبور"
            type="password"
            dir="ltr"
            className="text-left"
            hint="حداقل ۸ کاراکتر"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
          />
        </div>
      </Modal>
    </div>
  );
}
