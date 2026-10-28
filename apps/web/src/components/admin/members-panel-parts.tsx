'use client';

import { KeyRound, LogOut, Pencil, Power, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { SYSTEM_ROLE_LABELS, type SystemRole } from '@repo/shared';
import type { AdminMember, AdminTenantDetail } from '@/lib/admin-types';

export type EditState = {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  systemRole: string;
  branchId: string;
  roleId: string;
};

export function MembersFilters({
  search,
  statusFilter,
  onSearch,
  onStatus,
  onRefresh,
}: {
  search: string;
  statusFilter: string;
  onSearch: (value: string) => void;
  onStatus: (value: string) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Input
        placeholder="جستجوی نام، تلفن یا ایمیل"
        value={search}
        onChange={(event) => onSearch(event.target.value)}
      />
      <Select value={statusFilter} onChange={(event) => onStatus(event.target.value)}>
        <option value="">همه وضعیت‌ها</option>
        <option value="true">فقط فعال</option>
        <option value="false">فقط غیرفعال</option>
      </Select>
      <div className="flex items-center justify-end">
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4" />
          بروزرسانی
        </Button>
      </div>
    </div>
  );
}

export function MemberActions({
  member,
  onEdit,
  onToggle,
  onReset,
  onRevoke,
}: {
  member: AdminMember;
  onEdit: () => void;
  onToggle: () => void;
  onReset: () => void;
  onRevoke: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" title="ویرایش" className="h-8 w-8" onClick={onEdit}>
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        title={member.isActive ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
        className="h-8 w-8"
        onClick={onToggle}
      >
        <Power className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon" title="بازنشانی رمز" className="h-8 w-8" onClick={onReset}>
        <KeyRound className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon" title="بستن نشست‌ها" className="h-8 w-8" onClick={onRevoke}>
        <LogOut className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export function Pager({
  page,
  totalPages,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-slate-500">
        صفحه {page} از {totalPages}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={onPrev}>
          قبلی
        </Button>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={onNext}>
          بعدی
        </Button>
      </div>
    </div>
  );
}

export function EditMemberModal({
  edit,
  tenant,
  loading,
  onChange,
  onClose,
  onSave,
}: {
  edit: EditState | null;
  tenant: AdminTenantDetail;
  loading: boolean;
  onChange: (value: EditState) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <Modal
      open={Boolean(edit)}
      onClose={onClose}
      title="ویرایش کاربر"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            انصراف
          </Button>
          <Button loading={loading} onClick={onSave}>
            ذخیره
          </Button>
        </>
      }
    >
      {edit && (
        <div className="space-y-4">
          <Input
            label="نام کامل"
            value={edit.fullName}
            onChange={(event) => onChange({ ...edit, fullName: event.target.value })}
          />
          <Input
            label="موبایل"
            dir="ltr"
            className="text-left nums"
            value={edit.phone}
            onChange={(event) =>
              onChange({ ...edit, phone: event.target.value.replace(/\D/g, '').slice(0, 11) })
            }
          />
          <Input
            label="ایمیل"
            dir="ltr"
            className="text-left"
            value={edit.email}
            onChange={(event) => onChange({ ...edit, email: event.target.value })}
          />
          <Select
            label="نقش سیستمی"
            value={edit.systemRole}
            onChange={(event) => onChange({ ...edit, systemRole: event.target.value })}
          >
            {(Object.keys(SYSTEM_ROLE_LABELS) as SystemRole[]).map((role) => (
              <option key={role} value={role}>
                {SYSTEM_ROLE_LABELS[role]}
              </option>
            ))}
          </Select>
          <Select
            label="نقش دسترسی"
            value={edit.roleId}
            onChange={(event) => onChange({ ...edit, roleId: event.target.value })}
          >
            <option value="">بدون نقش</option>
            {tenant.roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </Select>
          <Select
            label="شعبه"
            value={edit.branchId}
            onChange={(event) => onChange({ ...edit, branchId: event.target.value })}
          >
            <option value="">بدون شعبه</option>
            {tenant.branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </Select>
        </div>
      )}
    </Modal>
  );
}

export function ResetPasswordModal({
  target,
  password,
  loading,
  onChange,
  onClose,
  onSave,
}: {
  target: AdminMember | null;
  password: string;
  loading: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <Modal
      open={Boolean(target)}
      onClose={onClose}
      title={`بازنشانی رمز عبور ${target?.fullName ?? ''}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            انصراف
          </Button>
          <Button loading={loading} disabled={password.length < 8} onClick={onSave}>
            بازنشانی
          </Button>
        </>
      }
    >
      <Input
        label="رمز عبور جدید"
        type="password"
        dir="ltr"
        className="text-left"
        value={password}
        hint="حداقل ۸ کاراکتر — نشست‌های فعال کاربر بسته می‌شوند"
        onChange={(event) => onChange(event.target.value)}
      />
    </Modal>
  );
}
