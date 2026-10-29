import { z } from 'zod';

export const publishAnnouncementSchema = z
  .object({
    title: z.string().trim().min(3, 'عنوان حداقل ۳ نویسه است').max(120),
    body: z.string().trim().min(3, 'متن اطلاعیه حداقل ۳ نویسه است').max(2000),
    audience: z.enum(['ALL', 'SELECTED']).default('ALL'),
    customerIds: z.array(z.string().uuid()).max(2000).optional(),
    /** روز رویداد — مثلاً روز تعطیلی باشگاه. */
    eventDate: z.coerce.date().optional(),
    /** آینه‌کردن در گروه بله (اگر اتصال فعال باشد). */
    mirrorToBale: z.boolean().default(true),
  })
  .refine((dto) => dto.audience !== 'SELECTED' || (dto.customerIds?.length ?? 0) > 0, {
    message: 'برای ارسال انتخابی، حداقل یک گیرنده انتخاب کنید',
    path: ['customerIds'],
  });

export type PublishAnnouncementDto = z.infer<typeof publishAnnouncementSchema>;

export const listAnnouncementsSchema = z.object({
  take: z.coerce.number().int().min(1).max(50).default(20),
});

export type ListAnnouncementsDto = z.infer<typeof listAnnouncementsSchema>;
