import { useEffect, useState } from 'react';
import type { Quadrant, Task } from '../../../shared/domain';
import type { TaskApi } from '../../../shared/ipc';
import { QuadrantBoard } from './QuadrantBoard';

export function QuadrantPage({ api, date }: { api: TaskApi; date: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setError(null);
    void api.listByDate(date)
      .then((items) => { if (active) setTasks(items); })
      .catch(() => { if (active) setError('读取事项失败，请重试'); });
    return () => { active = false; };
  }, [api, date]);

  async function move(id: string, quadrant: Quadrant) {
    setError(null);
    try {
      const updated = await api.update(id, { quadrant });
      setTasks((current) => current.map((task) => task.id === id ? updated : task));
    } catch {
      setError('移动事项失败，请重试');
    }
  }

  async function toggleComplete(task: Task) {
    setError(null);
    try {
      const updated = task.status === 'completed'
        ? await api.restore(task.id)
        : await api.complete(task.id);
      setTasks((current) => current.map((item) => item.id === task.id ? updated : item));
    } catch {
      setError(task.status === 'completed' ? '恢复事项失败，请重试' : '完成事项失败，请重试');
    }
  }

  async function toggleManualStrike(task: Task) {
    setError(null);
    try {
      const updated = await api.setManualStruck(task.id, !task.manualStruck);
      setTasks((current) => current.map((item) => item.id === task.id ? updated : item));
    } catch {
      setError('更新划线失败，请重试');
    }
  }

  return (
    <div className="mode-page quadrant-page">
      {error && <p className="inline-error" role="alert">{error}</p>}
      <QuadrantBoard
        tasks={tasks}
        onMove={move}
        onToggleComplete={toggleComplete}
        onToggleManualStrike={toggleManualStrike}
      />
    </div>
  );
}
