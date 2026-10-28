'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileSignature, FolderOpen, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiClientError } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth';
import { formatJalali, formatNumber, formatToman } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, Td, Th } from '@/components/ui/table';
import { Modal } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState, Skeleton } from '@/components/ui/empty-state';
import { CONTRACT_STATUS_LABELS, CONTRACT_STATUS_TONES } from '@/lib/status';
import type { Contract, ContractTemplate, Paginated } from '@/lib/types';

export default function DocumentsPage() {
  const token = getAccessToken();
  const queryClient = useQueryClient();
  const [templateOpen, setTemplateOpen] = useState(false);
  const [contractOpen, setContractOpen] = useState(false);
  const [templateForm, setTemplateForm] = useState({ title: '', body: '' });
  const [contractForm, setContractForm] = useState({ title: '', templateId: '', amount: '' });

  const templatesQuery = useQuery({
    queryKey: ['contract-templates'],
    queryFn: () => api.get<ContractTemplate[]>('/documents/templates', token),
  });

  const contractsQuery = useQuery({
    queryKey: ['contracts'],
    queryFn: () => api.get<Paginated<Contract>>('/documents/contracts?pageSize=50', token),
  });

  const createTemplate = useMutation({
    mutationFn: () => api.post('/documents/templates', templateForm, token),
    onSuccess: () => {
      toast.success('قالب قرارداد ثبت شد');
      setTemplateOpen(false);
      setTemplateForm({ title: '', body: '' });
      void queryClient.invalidateQueries({ queryKey: ['contract-templates'] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : 'خطا در ثبت قالب'),
  });

  const createContract = useMutation({
    mutationFn: () =>
      api.post(
        '/documents/contracts',
        {
          title: contractForm.title,
          templateId: contractForm.templateId || undefined,
          amount: contractForm.amount ? Number(contractForm.amount) : undefined,
        },
        token,
      ),
    onSuccess: () => {
      toast.success('قرارداد ایجاد شد');
      setContractOpen(false);
      setContractForm({ title: '', templateId: '', amount: '' });
      void queryClient.invalidateQueries({ queryKey: ['contracts'] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : 'خطا در ایجاد قرارداد'),
  });

  const sign = useMutation({
    mutationFn: (id: string) => api.post(`/documents/contracts/${id}/sign`, { signatureKey: 'signature' }, token),
    onSuccess: () => {
      toast.success('قرارداد امضا شد');
      void queryClient.invalidateQueries({ queryKey: ['contracts'] });
    },
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="اسناد و قرارداد"
        description="قالب قرارداد، امضای الکترونیکی، بایگانی و یادآور انقضا"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setTemplateOpen(true)}>
              <FolderOpen className="h-4 w-4" />
              قالب جدید
            </Button>
            <Button onClick={() => setContractOpen(true)}>
              <Plus className="h-4 w-4" />
              قرارداد جدید
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader
          title="قالب‌های قرارداد"
          action={<Badge tone="info">{formatNumber(templatesQuery.data?.length ?? 0)} قالب</Badge>}
        />
        <CardBody className="p-0">
          {templatesQuery.isLoading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : templatesQuery.data && templatesQuery.data.length > 0 ? (
            <Table>
              <thead>
                <tr>
                  <Th>عنوان</Th>
                  <Th>متن</Th>
                  <Th>وضعیت</Th>
                </tr>
              </thead>
              <tbody>
                {templatesQuery.data.map((t) => (
                  <tr key={t.id}>
                    <Td className="font-medium">{t.title}</Td>
                    <Td className="max-w-md truncate text-slate-500">{t.body}</Td>
                    <Td>{t.isActive ? <Badge tone="success">فعال</Badge> : <Badge>غیرفعال</Badge>}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState icon={FileSignature} title="قالبی ثبت نشده است" />
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="قراردادها" />
        <CardBody className="p-0">
          {contractsQuery.data && contractsQuery.data.data.length > 0 ? (
            <Table>
              <thead>
                <tr>
                  <Th>عنوان</Th>
                  <Th>مبلغ</Th>
                  <Th>انقضا</Th>
                  <Th>وضعیت</Th>
                  <Th>عملیات</Th>
                </tr>
              </thead>
              <tbody>
                {contractsQuery.data.data.map((c) => (
                  <tr key={c.id}>
                    <Td className="font-medium">{c.title}</Td>
                    <Td className="nums">{c.amount ? formatToman(c.amount) : '—'}</Td>
                    <Td className="nums">{formatJalali(c.expiresAt)}</Td>
                    <Td>
                      <Badge tone={CONTRACT_STATUS_TONES[c.status]}>
                        {CONTRACT_STATUS_LABELS[c.status]}
                      </Badge>
                    </Td>
                    <Td>
                      {c.status !== 'SIGNED' && (
                        <Button size="sm" onClick={() => sign.mutate(c.id)}>
                          امضا
                        </Button>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <p className="p-5 text-sm text-slate-500">قراردادی ثبت نشده است.</p>
          )}
        </CardBody>
      </Card>

      <Modal
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        title="ثبت قالب قرارداد"
        footer={
          <>
            <Button variant="outline" onClick={() => setTemplateOpen(false)}>
              انصراف
            </Button>
            <Button
              loading={createTemplate.isPending}
              disabled={templateForm.title.trim().length < 2 || templateForm.body.trim().length < 2}
              onClick={() => createTemplate.mutate()}
            >
              ثبت
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="عنوان"
            value={templateForm.title}
            onChange={(e) => setTemplateForm({ ...templateForm, title: e.target.value })}
          />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              متن قالب — از {`{{variable}}`} استفاده کنید
            </label>
            <textarea
              className="min-h-32 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              value={templateForm.body}
              onChange={(e) => setTemplateForm({ ...templateForm, body: e.target.value })}
              placeholder="اینجانب {{customerName}} ..."
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={contractOpen}
        onClose={() => setContractOpen(false)}
        title="ایجاد قرارداد"
        footer={
          <>
            <Button variant="outline" onClick={() => setContractOpen(false)}>
              انصراف
            </Button>
            <Button
              loading={createContract.isPending}
              disabled={contractForm.title.trim().length < 2}
              onClick={() => createContract.mutate()}
            >
              ایجاد
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="عنوان"
            value={contractForm.title}
            onChange={(e) => setContractForm({ ...contractForm, title: e.target.value })}
          />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">قالب</label>
            <select
              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              value={contractForm.templateId}
              onChange={(e) => setContractForm({ ...contractForm, templateId: e.target.value })}
            >
              <option value="">بدون قالب</option>
              {templatesQuery.data?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>
          <Input
            label="مبلغ (تومان)"
            dir="ltr"
            className="text-left nums"
            value={contractForm.amount}
            onChange={(e) => setContractForm({ ...contractForm, amount: e.target.value.replace(/\D/g, '') })}
          />
        </div>
      </Modal>
    </div>
  );
}
