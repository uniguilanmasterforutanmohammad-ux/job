'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiClientError } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardBody, CardHeader } from '@/components/ui/card';

const MIN_LENGTH = 8;

/**
 * Self-service password card (`POST /auth/password`). Anyone who is signed in
 * can use it — a شاگرد/زبان‌آموز who joined with an OTP gets their first
 * password here, staff can rotate an existing one. The current password is
 * only asked for when one already exists.
 */
export function ChangePasswordCard({
  hasPassword,
  onDone,
  title = 'رمز عبور',
  token: tokenProp,
}: {
  hasPassword?: boolean;
  /** Called after the password is stored (the API revokes sessions). */
  onDone?: () => void;
  title?: string;
  /** Token of the session to change (the portal uses its own storage key). */
  token?: string | null;
}) {
  const token = tokenProp ?? getAccessToken();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');

  const change = useMutation({
    mutationFn: () =>
      api.post<{ message: string }>(
        '/auth/password',
        {
          ...(hasPassword ? { currentPassword: current } : {}),
          newPassword: next,
        },
        token,
      ),
    onSuccess: (data) => {
      toast.success(data.message);
      setCurrent('');
      setNext('');
      setRepeat('');
      onDone?.();
    },
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : 'خطا در تغییر رمز عبور'),
  });

  const mismatch = repeat.length > 0 && repeat !== next;
  const canSubmit =
    next.length >= MIN_LENGTH && next === repeat && (!hasPassword || current.length > 0);

  return (
    <Card>
      <CardHeader
        title={title}
        description={
          hasPassword
            ? 'برای تغییر رمز، رمز فعلی را هم وارد کنید'
            : 'هنوز رمزی ندارید؛ بعد از تنظیم، می‌توانید با رمز عبور هم وارد شوید'
        }
      />
      <CardBody className="space-y-3">
        {hasPassword && (
          <Input
            label="رمز عبور فعلی"
            type="password"
            dir="ltr"
            className="text-left"
            autoComplete="current-password"
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
          />
        )}
        <Input
          label="رمز عبور جدید"
          hint={`حداقل ${MIN_LENGTH} کاراکتر`}
          type="password"
          dir="ltr"
          className="text-left"
          autoComplete="new-password"
          value={next}
          onChange={(event) => setNext(event.target.value)}
        />
        <Input
          label="تکرار رمز عبور جدید"
          error={mismatch ? 'تکرار رمز با رمز جدید یکسان نیست' : undefined}
          type="password"
          dir="ltr"
          className="text-left"
          autoComplete="new-password"
          value={repeat}
          onChange={(event) => setRepeat(event.target.value)}
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            بعد از ذخیره، نشست‌های قبلی بسته می‌شود و با رمز جدید وارد می‌شوید.
          </p>
          <Button loading={change.isPending} disabled={!canSubmit} onClick={() => change.mutate()}>
            <KeyRound className="h-4 w-4" />
            {hasPassword ? 'تغییر رمز' : 'تنظیم رمز'}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
