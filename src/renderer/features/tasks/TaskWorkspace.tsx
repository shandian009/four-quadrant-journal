import { useEffect, useRef, useState } from 'react';
import type { Task } from '../../../shared/domain';
import type { CreateTaskDto, FocusApi, TaskApi } from '../../../shared/ipc';
import { MonthCalendar, monthRange } from '../calendar/MonthCalendar';
import { FocusControl } from '../focus/FocusControl';
import { TaskForm } from './TaskForm';

interface MonthCacheEntry {
  promise: Promise<Task[]>;
  result?: Task[];
}

type RangeCache = Map<TaskApi, Map<string, MonthCacheEntry>>;

function cacheFor(rangeCache: RangeCache, api: TaskApi): Map<string, MonthCacheEntry> {
  let cache = rangeCache.get(api);
  if (!cache) {
    cache = new Map();
    rangeCache.set(api, cache);
  }
  return cache;
}

function loadMonth(rangeCache: RangeCache, api: TaskApi, month: string): Promise<Task[]> {
  const cache = cacheFor(rangeCache, api);
  const cached = cache.get(month);
  if (cached) return cached.promise;

  const { startDate, endDate } = monthRange(month);
  const entry: MonthCacheEntry = { promise: Promise.resolve([]) };
  entry.promise = api.listByRange(startDate, endDate)
    .then((items) => {
      entry.result = items;
      return items;
    })
    .catch((error: unknown) => {
      if (cache.get(month) === entry) cache.delete(month);
      throw error;
    });
  cache.set(month, entry);
  return entry.promise;
}

function updateCachedMonth(rangeCache: RangeCache, api: TaskApi, month: string, update: (tasks: Task[]) => Task[]): void {
  const cache = cacheFor(rangeCache, api);
  const current = cache.get(month);
  if (!current) return;

  const entry: MonthCacheEntry = { promise: Promise.resolve([]) };
  entry.promise = current.promise
    .then((items) => {
      const result = update(items);
      entry.result = result;
      return result;
    })
    .catch((error: unknown) => {
      if (cache.get(month) === entry) cache.delete(month);
      throw error;
    });
  cache.set(month, entry);
  void entry.promise.catch(() => undefined);
}

async function latestMonthResult(
  rangeCache: RangeCache,
  api: TaskApi,
  month: string,
  initialPromise: Promise<Task[]>
): Promise<Task[]> {
  let promise = initialPromise;
  while (true) {
    const items = await promise;
    const latestPromise = cacheFor(rangeCache, api).get(month)?.promise;
    if (!latestPromise || latestPromise === promise) return items;
    promise = latestPromise;
  }
}

function upsertTask(tasks: Task[], task: Task): Task[] {
  const existing = tasks.findIndex((item) => item.id === task.id);
  if (existing === -1) return [...tasks, task];
  return tasks.map((item) => item.id === task.id ? task : item);
}

export function TaskWorkspace({
  api,
  initialDate,
  focusApi,
  onSelectedDateChange,
  onDisplayMonthChange
}: {
  api: TaskApi;
  initialDate: string;
  focusApi?: FocusApi;
  onSelectedDateChange?(date: string): void;
  onDisplayMonthChange?(month: string): void;
}) {
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [displayMonth, setDisplayMonth] = useState(initialDate.slice(0, 7));
  const [tasks, setTasks] = useState<Task[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState('');
  const rangeCache = useRef<RangeCache>(new Map());
  const activeRange = useRef({ api, month: displayMonth });
  activeRange.current = { api, month: displayMonth };

  useEffect(() => {
    let active = true;
    setError('');
    const request = loadMonth(rangeCache.current, api, displayMonth);
    void latestMonthResult(rangeCache.current, api, displayMonth, request)
      .then((items) => {
        if (active && activeRange.current.api === api && activeRange.current.month === displayMonth) setTasks(items);
      })
      .catch(() => {
        if (active && activeRange.current.api === api && activeRange.current.month === displayMonth) setError('读取事项失败');
      });
    return () => { active = false; };
  }, [api, displayMonth]);

  async function createTask(input: CreateTaskDto) {
    const created = await api.create(input);
    const createdMonth = created.plannedDate.slice(0, 7);
    updateCachedMonth(rangeCache.current, api, createdMonth, (current) => upsertTask(current, created));
    if (createdMonth === displayMonth) setTasks((current) => upsertTask(current, created));
    setFormOpen(false);
  }

  function applyUpdatedTask(previous: Task, updated: Task) {
    const previousMonth = previous.plannedDate.slice(0, 7);
    const updatedMonth = updated.plannedDate.slice(0, 7);
    if (previousMonth !== updatedMonth) {
      updateCachedMonth(rangeCache.current, api, previousMonth, (current) => current.filter((item) => item.id !== updated.id));
    }
    updateCachedMonth(rangeCache.current, api, updatedMonth, (current) => upsertTask(current, updated));
    setTasks((current) => previousMonth === displayMonth && updatedMonth !== displayMonth
      ? current.filter((item) => item.id !== updated.id)
      : updatedMonth === displayMonth ? upsertTask(current, updated) : current);
  }

  async function toggleTaskStatus(task: Task) {
    setError('');
    if (task.status === 'completed') {
      try {
        const updated = await api.restore(task.id);
        applyUpdatedTask(task, updated);
      } catch {
        setError('恢复事项失败，请重试');
      }
      return;
    }

    try {
      const updated = await api.complete(task.id);
      applyUpdatedTask(task, updated);
    } catch {
      setError('完成事项失败，请重试');
    }
  }

  const selectedTasks = tasks.filter((task) => task.plannedDate === selectedDate && task.status !== 'deleted');

  function selectToday() {
    const today = new Date();
    const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    setSelectedDate(date);
    setDisplayMonth(date.slice(0, 7));
    onSelectedDateChange?.(date);
    onDisplayMonthChange?.(date.slice(0, 7));
  }

  function selectDate(date: string) {
    setSelectedDate(date);
    onSelectedDateChange?.(date);
  }

  function display(month: string) {
    setDisplayMonth(month);
    onDisplayMonthChange?.(month);
  }

  return (
    <div className="task-workspace">
      <section className="panel live-task-panel" role="region" aria-label="今日优先事项" data-testid="dashboard-region-priority">
        <header className="panel__header"><h2>今日优先事项</h2><button className="text-action" type="button" aria-label="添加事项" onClick={() => setFormOpen(true)}>＋ 添加事项</button></header>
        {error && <p className="inline-error" role="alert">{error}</p>}
        <div className="task-list">
          {selectedTasks.length === 0 && <p className="empty-state">今天还没有事项</p>}
          {selectedTasks.map((task) => (
            <article className={`task-row${task.status === 'completed' ? ' task-row--completed' : ''}`} key={task.id}>
              <button className="checkbox" type="button" aria-pressed={task.status === 'completed'} aria-label={`${task.status === 'completed' ? '恢复' : '完成'}“${task.title}”`} onClick={() => { void toggleTaskStatus(task); }} />
              <span className="task-row__content"><strong>{task.title}</strong><small>{task.notes || '未添加说明'}</small></span>
              {focusApi && <FocusControl api={focusApi} taskId={task.id} />}
              <span className="priority priority--accent">{task.quadrant === 'urgent_important' ? '紧急' : '重要'}</span>
            </article>
          ))}
        </div>
      </section>
      <MonthCalendar
        displayMonth={displayMonth}
        selectedDate={selectedDate}
        tasks={tasks}
        onSelect={selectDate}
        onDisplayMonthChange={display}
        onToday={selectToday}
        testId="dashboard-region-calendar"
      />
      {formOpen && <TaskForm plannedDate={selectedDate} onSave={createTask} onCancel={() => setFormOpen(false)} />}
    </div>
  );
}
