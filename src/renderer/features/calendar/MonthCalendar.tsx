import type { Task } from '../../../shared/domain';

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function shiftMonth(month: string, delta: number): string {
  const [year, value] = month.split('-').map(Number);
  const shifted = new Date(year, value - 1 + delta, 1);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}`;
}

export function monthRange(month: string): { startDate: string; endDate: string } {
  const [year, value] = month.split('-').map(Number);
  const end = new Date(year, value, 0).getDate();
  return { startDate: `${month}-01`, endDate: `${month}-${String(end).padStart(2, '0')}` };
}

export function MonthCalendar({
  displayMonth,
  selectedDate,
  tasks,
  onSelect,
  onDisplayMonthChange,
  onToday,
  testId
}: {
  displayMonth: string;
  selectedDate: string;
  tasks: Task[];
  onSelect(date: string): void;
  onDisplayMonthChange(month: string): void;
  onToday(): void;
  testId?: string;
}) {
  const [year, month] = displayMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const leading = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const cells = Array.from({ length: 42 }, (_, index) => {
    const day = index - leading + 1;
    return day >= 1 && day <= daysInMonth ? day : null;
  });

  return (
    <section className="panel task-calendar calendar-panel" role="region" aria-label="月历" data-testid={testId}>
      <header className="panel__header calendar-toolbar">
        <button type="button" aria-label="上个月" onClick={() => onDisplayMonthChange(shiftMonth(displayMonth, -1))}>‹</button>
        <h2>{year}年{month}月</h2>
        <button type="button" onClick={onToday}>今天</button>
        <button type="button" aria-label="下个月" onClick={() => onDisplayMonthChange(shiftMonth(displayMonth, 1))}>›</button>
      </header>
      <div className="calendar-head"><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span></div>
      <div className="calendar-days">
        {cells.map((day, index) => {
          if (!day) return <span key={index} className="calendar-day calendar-day--empty" />;
          const date = formatDate(year, month, day);
          const count = tasks.filter((task) => task.plannedDate === date && task.status !== 'deleted').length;
          return (
            <button
              key={date}
              type="button"
              data-testid={`calendar-day-${date}`}
              data-task-count={count}
              className={`calendar-day ${date === selectedDate ? 'calendar-day--current' : ''}`}
              onClick={() => onSelect(date)}
            >
              {day}{count > 0 && <i aria-label={`${count}项事项`} />}
            </button>
          );
        })}
      </div>
    </section>
  );
}
