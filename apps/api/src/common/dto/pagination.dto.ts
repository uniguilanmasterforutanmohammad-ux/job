import { z } from 'zod';

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional(),
  sortBy: z.string().max(60).optional(),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

export type PaginationDto = z.infer<typeof paginationSchema>;

export function toSkipTake(dto: Pick<PaginationDto, 'page' | 'pageSize'>) {
  return { skip: (dto.page - 1) * dto.pageSize, take: dto.pageSize };
}

export function buildMeta(total: number, dto: Pick<PaginationDto, 'page' | 'pageSize'>) {
  return {
    page: dto.page,
    pageSize: dto.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / dto.pageSize)),
  };
}
