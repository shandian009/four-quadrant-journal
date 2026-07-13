import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { TaskForm } from '../../src/renderer/features/tasks/TaskForm';

it('submits a normalized reminder time', async () => {
  const user = userEvent.setup();
  const onSave = vi.fn().mockResolvedValue(undefined);
  render(<TaskForm plannedDate="2026-07-10" onSave={onSave} onCancel={vi.fn()} />);

  await user.type(screen.getByLabelText('事项标题'), '提交项目报告');
  fireEvent.change(screen.getByLabelText('提醒时间'), { target: { value: '2026-07-10T16:00' } });
  await user.click(screen.getByRole('button', { name: '保存' }));

  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
    title: '提交项目报告',
    remindAt: '2026-07-10T16:00:00'
  }));
});
