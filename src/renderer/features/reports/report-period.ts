export type ReportKind = 'weekly' | 'monthly';

export interface ReportPeriod {
  startDate: string;
  endDate: string;
  title: string;
  suggestedName: string;
}

function parseLocalDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error('报告日期无效');
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  if (date.getFullYear() !== Number(match[1]) || date.getMonth() !== Number(match[2]) - 1 || date.getDate() !== Number(match[3])) {
    throw new Error('报告日期无效');
  }
  return date;
}

function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function reportPeriod(kind: ReportKind, anchorDate: string): ReportPeriod {
  const anchor = parseLocalDate(anchorDate);
  let start: Date;
  let end: Date;
  if (kind === 'weekly') {
    const mondayOffset = (anchor.getDay() + 6) % 7;
    start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - mondayOffset, 12);
    end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 12);
  } else {
    start = new Date(anchor.getFullYear(), anchor.getMonth(), 1, 12);
    end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0, 12);
  }
  const startDate = formatLocalDate(start);
  const endDate = formatLocalDate(end);
  const label = kind === 'weekly' ? '周报' : '月报';
  return {
    startDate,
    endDate,
    title: `${label}（${startDate} 至 ${endDate}）`,
    suggestedName: kind === 'weekly'
      ? `四象日志-周报-${startDate}.txt`
      : `四象日志-月报-${startDate.slice(0, 7)}.txt`
  };
}
