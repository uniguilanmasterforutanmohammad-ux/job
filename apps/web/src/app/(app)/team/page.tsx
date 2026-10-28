'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiClientError } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth';
import { useEndUserNoun } from '@/lib/use-industry-registry';
import { formatJalali } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, Td, Th } from '@/components/ui/table';
import { Modal } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/empty-state';
import type { MemberSummary, Paginated, Role } from '@/lib/types';

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'مالک',
  MANAGER: 'مدیر',
  STAFF: 'کارمند',
  ACCOUNTANT: 'حسابدار',
  RECEPTION: 'پذیرش',
  END_USER: 'کاربر نهایی',
};

const permissionOptions = (customers: string) => [
  { key: 'crm:read', label: `مشاهده ${customers}` },
  { key: 'crm:write', label: `ویرایش ${customers}` },
  { key: 'sch:read', label: 'مشاهده نوبت‌ها' },
  { key: 'sch:write', label: 'ویرایش نوبت‌ها' },
  { key: 'fin:read', label: 'مشاهده مالی' },
  { key: 'fin:write', label: 'ویرایش مالی' },
  { key: 'msg:read', label: 'مشاهده پیام‌ها' },
  { key: 'msg:write', label: 'ارسال پیام' },
  { key: 'rpt:read', label: 'مشاهده گزارش‌ها' },
];

export default function TeamPage() {
  const token = getAccessToken();
  const { plural } = useEndUserNoun();
  const queryClient = useQueryClient();
  const [memberOpen, setMemberOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [memberForm, setMemberForm] = useState({
    fullName: '',
    phone: '',
    systemRole: 'STAFF',
    roleId: '',
  });
  const [roleForm, setRoleForm] = useState({ key: '', name: '', permissions: [] as string[] });

  const membersQuery = useQuery({
    queryKey: ['members'],
    queryFn: () => api.get<Paginated<MemberSummary>>('/core/members?pageSize=50', token),
  });

  const rolesQuery = useQuery({
    queryKey: ['roles'],
    queryFn: () => api.get<Role[]>('/core/roles', token),
  });

  const createMember = useMutation({
    mutationFn: () =>
      api.post(
        '/core/members',
        {
          fullName: memberForm.fullName,
          phone: memberForm.phone || undefined,
          systemRole: memberForm.systemRole,
          roleId: memberForm.roleId || undefined,
        },
        token,
      ),
    onSuccess: () => {
      toast.success('کاربر افزوده شد');
      setMemberOpen(false);
      setMemberForm({ fullName: '', phone: '', systemRole: 'STAFF', roleId: '' });
      void queryClient.invalidateQueries({ queryKey: ['members'] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : 'خطا در افزودن کاربر'),
  });

  const createRole = useMutation({
    mutationFn: () => api.post('/core/roles', roleForm, token),
    onSuccess: () => {
      toast.success('نقش ساخته شد');
      setRoleOpen(false);
      setRoleForm({ key: '', name: '', permissions: [] });
      void queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : 'خطا در ساخت نقش'),
  });

  function togglePermission(key: string) {
    setRoleForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(key)
        ? prev.permissions.filter((p) => p !== key)
        : [...prev.permissions, key],
    }));
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="کاربران و نقش‌ها"
        description="مدیریت دسترسی اعضا به ماژول‌ها و شعبه‌ها"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setRoleOpen(true)}>
              <ShieldCheck className="h-4 w-4" />
              نقش جدید
            </Button>
            <Button onClick={() => setMemberOpen(true)}>
              <Plus className="h-4 w-4" />
              کاربر جدید
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader
          title="اعضای کسب‌وکار"
          action={<Badge tone="info">{membersQuery.data?.meta.total ?? 0} کاربر</Badge>}
        />
        <CardBody className="p-0">
          {membersQuery.isLoading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>نام</Th>
                  <Th>موبایل</Th>
                  <Th>نقش</Th>
                  <Th>نقش سفارشی</Th>
                  <Th>۲FA</Th>
                  <Th>آخرین ورود</Th>
                </tr>
              </thead>
              <tbody>
                {membersQuery.data?.data.map((member) => (
                  <tr key={member.id}>
                    <Td className="font-medium">{member.fullName}</Td>
                    <Td className="nums">{member.phone ?? '—'}</Td>
                    <Td>
                      <Badge tone={member.systemRole === 'OWNER' ? 'brand' : 'neutral'}>
                        {ROLE_LABELS[member.systemRole] ?? member.systemRole}
                      </Badge>
                    </Td>
                    <Td>{member.role?.name ?? '—'}</Td>
                    <Td>
                      {member.twoFactorEnabled ? (
                        <Badge tone="success">فعال</Badge>
                      ) : (
                        <Badge tone="neutral">غیرفعال</Badge>
                      )}
                    </Td>
                    <Td className="nums">{formatJalali(member.lastLoginAt)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="نقش‌های سفارشی" />
        <CardBody className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rolesQuery.data?.map((role) => (
            <div
              key={role.id}
              className="rounded-xl border border-slate-100 p-3 dark:border-slate-800"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-800 dark:text-slate-200">{role.name}</span>
                {role.isSystem && <Badge tone="info">سیستمی</Badge>}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {role.permissions.includes('*')
                  ? 'دسترسی کامل'
                  : `${role.permissions.length} مجوز`}
              </p>
            </div>
          ))}
        </CardBody>
      </Card>

      <Modal
        open={memberOpen}
        onClose={() => setMemberOpen(false)}
        title="افزودن کاربر"
        footer={
          <>
            <Button variant="outline" onClick={() => setMemberOpen(false)}>
              انصراف
            </Button>
            <Button
              loading={createMember.isPending}
              disabled={memberForm.fullName.trim().length < 2}
              onClick={() => createMember.mutate()}
            >
              افزودن
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="نام و نام خانوادگی"
            value={memberForm.fullName}
            onChange={(e) => setMemberForm({ ...memberForm, fullName: e.target.value })}
          />
          <Input
            label="موبایل"
            dir="ltr"
            className="text-left nums"
            value={memberForm.phone}
            onChange={(e) =>
              setMemberForm({ ...memberForm, phone: e.target.value.replace(/\D/g, '').slice(0, 11) })
            }
          />
          <Select
            label="نقش"
            value={memberForm.systemRole}
            onChange={(e) => setMemberForm({ ...memberForm, systemRole: e.target.value })}
          >
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          {/* نقش سفارشی (اختیاری): اگر انتخاب شود، مجوزهای همان نقش داده
              می‌شود؛ وگرنه نقش سیستمی بالا. */}
          <Select
            label="نقش سفارشی (اختیاری)"
            value={memberForm.roleId}
            onChange={(e) => setMemberForm({ ...memberForm, roleId: e.target.value })}
          >
            <option value="">— پیش‌فرض نقش سیستمی —</option>
            {(rolesQuery.data ?? [])
              .filter((role) => !role.isSystem)
              .map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
          </Select>
        </div>
      </Modal>

      <Modal
        open={roleOpen}
        onClose={() => setRoleOpen(false)}
        title="ساخت نقش"
        footer={
          <>
            <Button variant="outline" onClick={() => setRoleOpen(false)}>
              انصراف
            </Button>
            <Button
              loading={createRole.isPending}
              disabled={roleForm.name.trim().length < 2 || roleForm.permissions.length === 0}
              onClick={() => createRole.mutate()}
            >
              ساخت
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="نام نقش"
            value={roleForm.name}
            onChange={(e) =>
              setRoleForm({
                ...roleForm,
                name: e.target.value,
                key: e.target.value ? `role_${Date.now().toString(36)}` : '',
              })
            }
          />
          <div className="space-y-2">
            <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">مجوزها</span>
            <div className="grid grid-cols-2 gap-2">
              {permissionOptions(plural).map((perm) => (
                <label
                  key={perm.key}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 p-2 text-sm dark:border-slate-700"
                >
                  <input
                    type="checkbox"
                    checked={roleForm.permissions.includes(perm.key)}
                    onChange={() => togglePermission(perm.key)}
                  />
                  {perm.label}
                </label>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
