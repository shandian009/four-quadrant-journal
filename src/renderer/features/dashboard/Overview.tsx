import { useEffect, useState } from 'react';
import type { DailyStatistics, StatisticsApi } from '../../../shared/ipc';

function formatHours(seconds: number): string {
  if (seconds === 0) return '0h';
  return `${(seconds / 3600).toFixed(1)}h`;
}

export function Overview({ statistics }: { statistics: DailyStatistics }) {
  const rows = [
    ['计划完成度', `${statistics.completionRate}%`, statistics.completionRate],
    ['专注时长', formatHours(statistics.focusSeconds), Math.min(100, Math.round(statistics.focusSeconds / 288))],
    ['完成事项', `${statistics.completed}/${statistics.planned}`, statistics.completionRate],
    ['待处理事项', String(statistics.pending), statistics.planned ? Math.round((statistics.pending / statistics.planned) * 100) : 0]
  ] as const;

  return (
    <div className="overview-list">
      {rows.map(([label, value, progress]) => (
        <div className="overview-row" key={label}>
          <span className="overview-row__icon" aria-hidden="true" />
          <span>{label}</span>
          <strong>{value}</strong>
          <span className="progress"><i style={{ width: `${progress}%` }} /></span>
        </div>
      ))}
    </div>
  );
}

const EMPTY: DailyStatistics = { planned: 0, completed: 0, pending: 0, completionRate: 0, focusSeconds: 0 };

export function OverviewLoader({ api, date }: { api: StatisticsApi; date: string }) {
  const [statistics, setStatistics] = useState(EMPTY);
  useEffect(() => {
    let active = true;
    void api.forDate(date).then((value) => { if (active) setStatistics(value); });
    return () => { active = false; };
  }, [api, date]);
  return <Overview statistics={statistics} />;
}
