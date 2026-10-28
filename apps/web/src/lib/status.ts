import type { Appointment } from './types';

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand';

export const APPOINTMENT_STATUS_LABELS: Record<Appointment['status'], string> = {
  SCHEDULED: 'زمان‌بندی‌شده',
  CONFIRMED: 'تأییدشده',
  COMPLETED: 'انجام‌شده',
  CANCELED: 'لغوشده',
  NO_SHOW: 'غیبت',
  WAITLIST: 'لیست انتظار',
};

export const APPOINTMENT_STATUS_TONES: Record<Appointment['status'], Tone> = {
  SCHEDULED: 'info',
  CONFIRMED: 'brand',
  COMPLETED: 'success',
  CANCELED: 'neutral',
  NO_SHOW: 'danger',
  WAITLIST: 'warning',
};

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'پیش‌نویس',
  ISSUED: 'صادرشده',
  PARTIALLY_PAID: 'پرداخت جزئی',
  PAID: 'پرداخت‌شده',
  OVERDUE: 'معوق',
  CANCELED: 'لغوشده',
  REFUNDED: 'بازگشت‌داده‌شده',
};

export const INVOICE_STATUS_TONES: Record<string, Tone> = {
  DRAFT: 'neutral',
  ISSUED: 'info',
  PARTIALLY_PAID: 'warning',
  PAID: 'success',
  OVERDUE: 'danger',
  CANCELED: 'neutral',
  REFUNDED: 'neutral',
};

export const LEAD_STAGE_LABELS: Record<string, string> = {
  LEAD: 'سرنخ',
  NEGOTIATION: 'مذاکره',
  WON: 'ثبت‌شده',
  LOST: 'از دست رفته',
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'نقدی',
  POS: 'کارت‌خوان',
  CARD_TO_CARD: 'کارت به کارت',
  ONLINE_GATEWAY: 'درگاه آنلاین',
  WALLET: 'کیف پول',
  CHECK: 'چک',
  CUSTOMER_CREDIT: 'اعتبار مشتری',
};

// ----- Phase 2 modules -----

export const SUB_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'فعال',
  FROZEN: 'منجمد',
  EXPIRED: 'منقضی',
  CANCELED: 'لغوشده',
};
export const SUB_STATUS_TONES: Record<string, Tone> = {
  ACTIVE: 'success',
  FROZEN: 'info',
  EXPIRED: 'warning',
  CANCELED: 'neutral',
};

export const INSTALLMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: 'در انتظار',
  PAID: 'پرداخت‌شده',
  OVERDUE: 'معوق',
  CANCELED: 'لغوشده',
};
export const INSTALLMENT_STATUS_TONES: Record<string, Tone> = {
  PENDING: 'info',
  PAID: 'success',
  OVERDUE: 'danger',
  CANCELED: 'neutral',
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: 'در انتظار',
  CONFIRMED: 'تأییدشده',
  PREPARING: 'در حال آماده‌سازی',
  SHIPPED: 'ارسال‌شده',
  DELIVERED: 'تحویل‌شده',
  CANCELED: 'لغوشده',
};
export const ORDER_STATUS_TONES: Record<string, Tone> = {
  PENDING: 'warning',
  CONFIRMED: 'info',
  PREPARING: 'brand',
  SHIPPED: 'info',
  DELIVERED: 'success',
  CANCELED: 'neutral',
};

export const CONTRACT_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'پیش‌نویس',
  SENT: 'ارسال‌شده',
  SIGNED: 'امضاشده',
  EXPIRED: 'منقضی',
  CANCELED: 'لغوشده',
};
export const CONTRACT_STATUS_TONES: Record<string, Tone> = {
  DRAFT: 'neutral',
  SENT: 'info',
  SIGNED: 'success',
  EXPIRED: 'warning',
  CANCELED: 'neutral',
};

export const CAMPAIGN_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'پیش‌نویس',
  ACTIVE: 'فعال',
  COMPLETED: 'تکمیل‌شده',
  CANCELED: 'لغوشده',
};
export const CAMPAIGN_STATUS_TONES: Record<string, Tone> = {
  DRAFT: 'neutral',
  ACTIVE: 'brand',
  COMPLETED: 'success',
  CANCELED: 'neutral',
};

export const LEAVE_STATUS_LABELS: Record<string, string> = {
  PENDING: 'در انتظار',
  APPROVED: 'تأییدشده',
  REJECTED: 'ردشده',
};
export const LEAVE_STATUS_TONES: Record<string, Tone> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
};

export const PAYROLL_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'پیش‌نویس',
  FINALIZED: 'نهایی‌شده',
  PAID: 'پرداخت‌شده',
};
export const PAYROLL_STATUS_TONES: Record<string, Tone> = {
  DRAFT: 'neutral',
  FINALIZED: 'info',
  PAID: 'success',
};

export const GIFT_CARD_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'فعال',
  USED: 'مصرف‌شده',
  EXPIRED: 'منقضی',
  CANCELED: 'لغوشده',
};

export const WAITLIST_STATUS_LABELS: Record<string, string> = {
  WAITING: 'در انتظار',
  OFFERED: 'پیشنهاد شده',
  CONVERTED: 'تبدیل‌شده',
  CANCELED: 'لغوشده',
};

export const MESSAGE_STATUS_LABELS: Record<string, string> = {
  QUEUED: 'در صف',
  SENT: 'ارسال‌شده',
  DELIVERED: 'تحویل‌شده',
  READ: 'خوانده‌شده',
  FAILED: 'ناموفق',
};

export const MESSAGE_CHANNEL_LABELS: Record<string, string> = {
  SMS: 'پیامک',
  WHATSAPP: 'واتس‌اپ',
  EMAIL: 'ایمیل',
  PUSH: 'پوش',
  IN_APP: 'درون‌برنامه‌ای',
};
