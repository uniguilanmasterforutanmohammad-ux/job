'use client';

import { MessageSquare } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';

export default function MessagesPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">پیام‌ها</h1>
        <p className="mt-1 text-sm text-slate-500">
          پیامک، واتس‌اپ، ایمیل و اعلان‌ها — کانال‌ها از طریق ماژول MSG
        </p>
      </div>

      <Card>
        <CardHeader title="صندوق پیام" description="پیام‌های ارسالی و زمان‌بندی‌شده" />
        <CardBody>
          <EmptyState
            icon={MessageSquare}
            title="هنوز پیامی ارسال نشده است"
            description="پس از اتصال درگاه پیامک (کاوه‌نگار/ملی‌پیامک) این بخش فعال می‌شود."
          />
        </CardBody>
      </Card>
    </div>
  );
}
