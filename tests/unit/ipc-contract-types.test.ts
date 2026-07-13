import { describe, expect, expectTypeOf, it } from 'vitest';
import type { TaskApi, UpdateTaskDto } from '../../src/shared/ipc';

describe('shared task update contract', () => {
  it('uses the shared update DTO at the TaskApi boundary', () => {
    expectTypeOf<Parameters<TaskApi['update']>[1]>().toEqualTypeOf<UpdateTaskDto>();

    const validPatch: UpdateTaskDto = { quadrant: 'important', sortOrder: 2 };
    expectTypeOf(validPatch).toMatchTypeOf<UpdateTaskDto>();

    // @ts-expect-error manual strike has a dedicated API
    const manualStrikePatch: UpdateTaskDto = { manualStruck: true };
    // @ts-expect-error completion state has a dedicated API
    const statusPatch: UpdateTaskDto = { status: 'completed' };
    // @ts-expect-error completion timestamps are not accepted by generic update
    const completionPatch: UpdateTaskDto = { completedAt: '2026-07-11T00:00:00.000Z' };

    expect([manualStrikePatch, statusPatch, completionPatch]).toHaveLength(3);
  });
});
