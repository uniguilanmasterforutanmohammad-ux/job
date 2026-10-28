'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserCog } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiClientError } from '@/lib/api-client';
import { getAdminToken, isAtLeast, useAdminAuth } from '@/lib/admin-auth';
import { formatJalali } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Table, Td, Th } from '@/components/ui/table';
import { EmptyState, Skeleton } from '@/components/ui/empty-state';
import { SYSTEM_ROLE_LABELS, type SystemRole } from '@repo/shared';
import {
  EditMemberModal,
  MemberActions,
  MembersFilters,
  Pager,
  ResetPasswordModal,
  type EditState,
} from './members-panel-parts';
import type { AdminMember, AdminTenantDetail } from '@/lib/admin-types';
import type { Paginated } from '@/lib/types';

export function MembersPanel({ tenant }: { tenant: AdminTenantDetail }) {
  const token = getAdminToken();
  const queryClient = useQueryClient();
  const { operator } = useAdminAuth();
  const canEdit = isAtLeast(operator?.role, 'ADMIN');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [resetTarget, setResetTarget] = useState<AdminMember | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin-members', tenant.id] });
    void queryClient.invalidateQueries({ queryKey: ['admin-tenant', tenant.id] });
  };

  const query = useQuery({
    queryKey: ['admin-members', tenant.id, { search, statusFilter, page }],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (search) params.set('search', search);
      if (statusFilter) params.set('isActive', statusFilter);
      return api.get<Paginated<AdminMember>>(
        `/admin/tenants/${tenant.id}/members?${params}`,
        token,
      );
    },
  });

  const updateMember = useMutation({
    mutationFn: (payload: EditState) =>
      api.patch(
        `/admin/tenants/${tenant.id}/members/${payload.id}`,
        {
          fullName: payload.fullName,
          phone: payload.phone || undefined,
          email: payload.email || undefined,
          systemRole: payload.systemRole,
          branchId: payload.branchId || null,
          roleId: payload.roleId || null,
        },
        token,
      ),
    onSuccess: () => {
      toast.success('کاربر ویرایش شد');
      setEdit(null);
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : 'خطا در ویرایش کاربر'),
  });

  const toggleStatus = useMutation({
    mutationFn: (member: AdminMember) =>
      api.post(
        `/admin/tenants/${tenant.id}/members/${member.id}/status`,
        { isActive: !member.isActive },
        token,
      ),
    onSuccess: (_data, member) => {
      toast.success(member.isActive ? 'کاربر غیرفعال شد' : 'کاربر فعال شد');
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : 'خطا در تغییر وضعیت'),
  });

  const resetPassword = useMutation({
    mutationFn: (payload: { id: string; password: string }) =>
      api.post(
        `/admin/tenants/${tenant.id}/members/${payload.id}/reset-password`,
        { password: payload.password },
        token,
      ),
    onSuccess: () => {
      toast.success('رمز عبور بازنشانی شد');
      setResetTarget(null);
      setNewPassword('');
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : 'خطا در بازنشانی رمز'),
  });

  const revokeSessions = useMutation({
    mutationFn: (memberId: string) =>
      api.post(`/admin/tenants/${tenant.id}/members/${memberId}/revoke-sessions`, {}, token),
    onSuccess: () => toast.success('نشست‌های کاربر بسته شد'),
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : 'خطا در بستن نشست‌ها'),
  });

  return (
    <div className="space-y-4">
      <MembersFilters
        search={search}
        statusFilter={statusFilter}
        onSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
        onStatus={(value) => {
          setStatusFilter(value);
          setPage(1);
        }}
        onRefresh={invalidate}
      />

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800">
        {query.isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : query.data && query.data.data.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>نام</Th>
                <Th>موبایل</Th>
                <Th>نقش سیستمی</Th>
                <Th>نقش دسترسی</Th>
                <Th>شعبه</Th>
                <Th>وضعیت</Th>
                <Th>آخرین ورود</Th>
                <Th>عملیات</Th>
              </tr>
            </thead>
            <tbody>
              {query.data.data.map((member) => (
                <tr key={member.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <Td>
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      {member.fullName}
                    </p>
                    {member.email && (
                      <p className="text-xs text-slate-400" dir="ltr">
                        {member.email}
                      </p>
                    )}
                  </Td>
                  <Td className="nums" dir="ltr">
                    {member.phone ?? '—'}
                  </Td>
                  <Td>
                    <Badge tone="info">
                      {SYSTEM_ROLE_LABELS[member.systemRole as SystemRole] ?? member.systemRole}
                    </Badge>
                  </Td>
                  <Td className="text-slate-500">{member.role?.name ?? '—'}</Td>
                  <Td className="text-slate-500">{member.branch?.name ?? '—'}</Td>
                  <Td>
                    {member.isActive ? (
                      <Badge tone="success">فعال</Badge>
                    ) : (
                      <Badge tone="danger">غیرفعال</Badge>
                    )}
                    {member.twoFactorEnabled && (
                      <Badge tone="brand" className="ms-1">
                        ۲FA
                      </Badge>
                    )}
                  </Td>
                  <Td className="text-slate-500">{formatJalali(member.lastLoginAt, true)}</Td>
                  <Td>
                    {canEdit && (
                      <MemberActions
                        member={member}
                        onEdit={() =>
                          setEdit({
                            id: member.id,
                            fullName: member.fullName,
                            phone: member.phone ?? '',
                            email: member.email ?? '',
                            systemRole: member.systemRole,
                            branchId: member.branchId ?? '',
                            roleId: member.roleId ?? '',
                          })
                        }
                        onToggle={() => toggleStatus.mutate(member)}
                        onReset={() => {
                          setResetTarget(member);
                          setNewPassword('');
                        }}
                        onRevoke={() => revokeSessions.mutate(member.id)}
                      />
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState icon={UserCog} title="کاربری یافت نشد" description="فیلترها را تغییر دهید" />
        )}
      </div>

      {query.data && query.data.meta.totalPages > 1 && (
        <Pager
          page={query.data.meta.page}
          totalPages={query.data.meta.totalPages}
          onPrev={() => setPage((prev) => Math.max(1, prev - 1))}
          onNext={() => setPage((prev) => prev + 1)}
        />
      )}

      <EditMemberModal
        edit={edit}
        tenant={tenant}
        loading={updateMember.isPending}
        onChange={setEdit}
        onClose={() => setEdit(null)}
        onSave={() => edit && updateMember.mutate(edit)}
      />

      <ResetPasswordModal
        target={resetTarget}
        password={newPassword}
        loading={resetPassword.isPending}
        onChange={setNewPassword}
        onClose={() => setResetTarget(null)}
        onSave={() =>
          resetTarget && resetPassword.mutate({ id: resetTarget.id, password: newPassword })
        }
      />
    </div>
  );
}
