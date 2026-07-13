import { z } from 'zod';
import type { UpdateTaskDto } from '../shared/ipc';

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}, '日期格式无效');

export const rangeSchema = z.object({ startDate: dateSchema, endDate: dateSchema })
  .refine(({ startDate, endDate }) => startDate <= endDate, '起始日期不能晚于结束日期');

export const idSchema = z.custom<string>(
  (value) => typeof value === 'string' && value.length > 0,
  '事项编号无效'
);

const optionalDateTime = z.string().datetime({ local: true }).nullable().optional().default(null);
const partialDateTime = z.string().datetime({ local: true }).nullable().optional();

export const quadrantSchema = z.enum(['urgent_important', 'important', 'urgent', 'neither']);

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, '事项标题不能为空').max(120, '事项标题不能超过120个字符'),
  notes: z.string().max(5000).optional().default(''),
  quadrant: quadrantSchema,
  plannedDate: dateSchema,
  dueAt: optionalDateTime,
  remindAt: optionalDateTime,
  estimatedMinutes: z.number().int().positive().nullable().optional().default(null)
});

const updateTaskShape = {
  title: z.string().trim().min(1).max(120).optional(),
  notes: z.string().max(5000).optional(),
  quadrant: quadrantSchema.optional(),
  plannedDate: dateSchema.optional(),
  dueAt: partialDateTime,
  remindAt: partialDateTime,
  estimatedMinutes: z.number().int().positive().nullable().optional(),
  sortOrder: z.number().int().nonnegative().optional()
} satisfies Record<keyof UpdateTaskDto, z.ZodType>;

export const updateTaskSchema: z.ZodType<UpdateTaskDto> = z.object(updateTaskShape).strict();
