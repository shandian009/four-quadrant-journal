import { afterEach, describe, expect, it } from 'vitest';
import { createTaskSchema, idSchema, rangeSchema, updateTaskSchema } from '../../src/main/ipc-validation';

const originalTimezone = process.env.TZ;

afterEach(() => {
  process.env.TZ = originalTimezone;
});

describe('task IPC validation', () => {
  it('rejects an empty title', () => {
    expect(() => createTaskSchema.parse({
      title: '   ',
      quadrant: 'important',
      plannedDate: '2026-07-10'
    })).toThrow('事项标题不能为空');
  });

  it('rejects an unknown quadrant', () => {
    expect(() => createTaskSchema.parse({
      title: '提交报告',
      quadrant: 'later',
      plannedDate: '2026-07-10'
    })).toThrow();
  });

  it('normalizes a valid task', () => {
    expect(createTaskSchema.parse({
      title: '  提交报告  ',
      quadrant: 'urgent_important',
      plannedDate: '2026-07-10'
    })).toMatchObject({ title: '提交报告', notes: '', remindAt: null });
  });

  it('does not clear omitted reminder fields during a partial update', () => {
    expect(updateTaskSchema.parse({ quadrant: 'important' })).toEqual({ quadrant: 'important' });
  });

  it('accepts inclusive valid date ranges', () => {
    expect(rangeSchema.parse({ startDate: '2026-07-01', endDate: '2026-07-01' }))
      .toEqual({ startDate: '2026-07-01', endDate: '2026-07-01' });
  });

  it('rejects impossible dates and reversed ranges', () => {
    expect(() => rangeSchema.parse({ startDate: '2026-02-30', endDate: '2026-03-01' }))
      .toThrow('日期格式无效');
    expect(() => rangeSchema.parse({ startDate: '2026-07-31', endDate: '2026-07-01' }))
      .toThrow('起始日期不能晚于结束日期');
  });

  it.each(['Pacific/Kiritimati', 'Etc/GMT+12'])(
    'validates calendar dates independently of the %s timezone',
    (timezone) => {
      process.env.TZ = timezone;

      expect(rangeSchema.parse({ startDate: '2024-02-29', endDate: '2024-02-29' }))
        .toEqual({ startDate: '2024-02-29', endDate: '2024-02-29' });
      expect(() => rangeSchema.parse({ startDate: '2023-02-29', endDate: '2023-03-01' }))
        .toThrow('日期格式无效');
      expect(() => rangeSchema.parse({ startDate: '2026-02-30', endDate: '2026-03-01' }))
        .toThrow('日期格式无效');
    }
  );

  it.each(['manualStruck', 'status', 'completedAt'])(
    'rejects unsupported %s fields instead of silently dropping them',
    (field) => {
      expect(() => updateTaskSchema.parse({ [field]: field === 'manualStruck' ? true : 'active' }))
        .toThrow();
    }
  );

  it('rejects empty and non-string IPC task IDs', () => {
    expect(() => idSchema.parse('')).toThrow('事项编号无效');
    expect(() => idSchema.parse(42)).toThrow('事项编号无效');
  });
});
