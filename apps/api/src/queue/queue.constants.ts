/** Named BullMQ queues used across the platform. */
export const QUEUE_NAMES = {
  MESSAGES: 'messages',
  NOTIFICATIONS: 'notifications',
  AUTOMATION: 'automation',
  REPORTS: 'reports',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

/** Job names inside the `messages` queue. */
export const MESSAGE_JOBS = {
  SEND: 'send-message',
} as const;

/** Job names inside the `notifications` queue. */
export const NOTIFICATION_JOBS = {
  DISPATCH: 'dispatch-notification',
} as const;

/** Job names inside the `automation` queue (scheduled/background work). */
export const AUTOMATION_JOBS = {
  APPOINTMENT_REMINDER: 'appointment-reminder',
  SUBSCRIPTION_RENEWAL: 'subscription-renewal',
  INSTALLMENT_OVERDUE: 'installment-overdue',
  DEDUCT_STOCK_FOR_SERVICE: 'deduct-stock-for-service',
  DOCUMENT_EXPIRY: 'document-expiry-reminder',
} as const;
