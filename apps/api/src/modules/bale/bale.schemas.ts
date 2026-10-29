import { z } from 'zod';

/** Events the owner can choose to mirror into the Bale group. */
export const BALE_EVENTS = [
  'announcement',
  'order.created',
  'order.canceled',
  'order.shipped',
  'appointment_reminder',
  'document.expiring',
] as const;

export const baleEventSchema = z.enum(BALE_EVENTS);

const groupLinkSchema = z
  .string()
  .trim()
  .max(200)
  .refine(
    (value) => value === '' || /^(https?:\/\/)?(ble\.ir|bale\.ai)\/join\/[A-Za-z0-9_-]+$/i.test(value),
    'لینک گروه باید به شکل ble.ir/join/… باشد',
  );

export const saveBaleSettingsSchema = z.object({
  // The token is only sent when the owner adds or replaces it; the stored token
  // is never echoed back to the browser.
  botToken: z.string().trim().min(10).max(200).optional(),
  groupLink: groupLinkSchema.optional(),
  /** Numeric chat id (or @username) — filled automatically when we can resolve it. */
  chatId: z
    .string()
    .trim()
    .max(64)
    .regex(/^(-?\d+|@[A-Za-z0-9_]{4,})$/, 'شناسهٔ گروه باید عددی باشد')
    .optional(),
  adminConfirmed: z.boolean().optional(),
  isActive: z.boolean().optional(),
  events: z.array(baleEventSchema).max(BALE_EVENTS.length).optional(),
});

export type SaveBaleSettingsDto = z.infer<typeof saveBaleSettingsSchema>;

export const discoverBaleSchema = z.object({
  /** Optional link to disambiguate when the bot sits in several groups. */
  groupLink: groupLinkSchema.optional(),
});

export type DiscoverBaleDto = z.infer<typeof discoverBaleSchema>;
