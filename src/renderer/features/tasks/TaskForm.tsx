import { useState } from 'react';
import type { CreateTaskDto } from '../../../shared/ipc';

export function TaskForm({
  plannedDate,
  onSave,
  onCancel
}: {
  plannedDate: string;
  onSave(input: CreateTaskDto): Promise<void>;
  onCancel(): void;
}) {
  const [title, setTitle] = useState('');
  const [quadrant, setQuadrant] = useState<CreateTaskDto['quadrant']>('important');
  const [remindAt, setRemindAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) {
      setError('请输入事项标题');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave({
        title: title.trim(),
        quadrant,
        plannedDate,
        remindAt: remindAt ? `${remindAt}:00` : null
      });
    } catch {
      setError('保存失败，请重试');
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="task-dialog" role="dialog" aria-modal="true" aria-labelledby="task-dialog-title">
        <header><h2 id="task-dialog-title">添加事项</h2><button type="button" onClick={onCancel} aria-label="关闭">×</button></header>
        <form onSubmit={submit}>
          <label>事项标题<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          <label>所属象限
            <select value={quadrant} onChange={(event) => setQuadrant(event.target.value as CreateTaskDto['quadrant'])}>
              <option value="urgent_important">重要且紧急</option>
              <option value="important">重要不紧急</option>
              <option value="urgent">紧急不重要</option>
              <option value="neither">不紧急不重要</option>
            </select>
          </label>
          <label>计划日期<input type="date" value={plannedDate} readOnly /></label>
          <label>提醒时间<input type="datetime-local" value={remindAt} onChange={(event) => setRemindAt(event.target.value)} /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <footer><button type="button" onClick={onCancel}>取消</button><button className="primary-button" type="submit" disabled={saving}>保存</button></footer>
        </form>
      </section>
    </div>
  );
}
