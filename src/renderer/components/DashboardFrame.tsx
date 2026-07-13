import { useState } from 'react';
import type { ThemeId, ThemeOverride } from '../theme/resolve-theme';
import type { JournalApi, TaskApi } from '../../shared/ipc';
import { TaskWorkspace } from '../features/tasks/TaskWorkspace';
import { OverviewLoader } from '../features/dashboard/Overview';
import { DailyReviewEditor } from '../features/review/DailyReviewEditor';
import { themeStyle } from '../theme/themes';
import { Panel } from './Panel';
import { Sidebar, type NavigationId } from './Sidebar';
import { SettingsPage } from '../features/settings/SettingsPage';
import { QuadrantPage } from '../features/tasks/QuadrantPage';
import { MonthCalendar } from '../features/calendar/MonthCalendar';
import { WorkbenchToolbar } from '../features/toolbar/WorkbenchToolbar';
import type { ThemeSelection } from '../features/toolbar/theme-cycle';
import { ReportDialog } from '../features/reports/ReportDialog';
import type { ReportKind } from '../features/reports/report-period';

const tasks = [
  ['完成 Q3 战略复盘报告', '战略项目组', '紧急'],
  ['与客户确认项目范围', '客户成功部', '重要'],
  ['推进数据看板优化', '产品团队', '重要'],
  ['团队周会与风险同步', '团队管理', '常规'],
  ['阅读行业研究报告', '个人成长', '常规']
] as const;

const overview = [
  ['计划完成度', '75%'],
  ['专注时长', '6.2h'],
  ['完成事项', '6/8'],
  ['待处理事项', '2']
] as const;

const reviewSections = ['今日收获', '待改进', '明日重点'] as const;

const viewTitles: Record<NavigationId, string> = {
  'today-workbench': '今日工作台',
  today: '今天',
  quadrants: '四象限',
  calendar: '日历',
  review: '复盘',
  statistics: '统计',
  settings: '设置'
};

function localDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function DashboardFrame({
  themeId,
  taskApi,
  journalApi,
  now = () => new Date(),
  themeSelection = themeId,
  themeLoading = false,
  themeError = null,
  onThemeAttempt,
  onThemeChange = () => undefined
}: {
  themeId: ThemeId;
  themeSelection?: ThemeSelection;
  themeLoading?: boolean;
  themeError?: string | null;
  onThemeAttempt?(): void;
  taskApi?: TaskApi;
  journalApi?: JournalApi;
  now?: () => Date;
  onThemeChange?(override: ThemeOverride | null): void;
}) {
  const today = localDate(now());
  const [view, setView] = useState<NavigationId>('today-workbench');
  const [previewSelectedDate, setPreviewSelectedDate] = useState(today);
  const [previewDisplayMonth, setPreviewDisplayMonth] = useState(today.slice(0, 7));
  const [reportSelectedDate, setReportSelectedDate] = useState(today);
  const [reportDisplayMonth, setReportDisplayMonth] = useState(today.slice(0, 7));
  const [reportKind, setReportKind] = useState<ReportKind | null>(null);
  return (
    <div className="application-shell" data-testid="application-shell" data-theme={themeId} style={themeStyle(themeId)}>
      <Sidebar active={view} onNavigate={setView} />
      <main className="workspace">
        <header className="workspace__header">
          <h1>{viewTitles[view]}</h1>
          <WorkbenchToolbar
            themeId={themeId}
            selection={themeSelection}
            settings={journalApi?.settings}
            windowApi={journalApi?.window}
            disabled={themeLoading}
            statusMessage={themeError}
            now={now}
            onThemeAttempt={onThemeAttempt}
            onThemeChange={onThemeChange}
            onWeeklyReport={journalApi ? () => setReportKind('weekly') : undefined}
            onMonthlyReport={journalApi ? () => setReportKind('monthly') : undefined}
          />
        </header>

        {view === 'settings' && journalApi ? (
          <SettingsPage settings={journalApi.settings} backup={journalApi.backup} onThemeChange={onThemeChange} />
        ) : view === 'quadrants' && journalApi ? (
          <QuadrantPage api={journalApi.tasks} date={today} />
        ) : (view === 'calendar' || view === 'today') && journalApi ? (
          <div className="mode-page calendar-mode"><TaskWorkspace api={journalApi.tasks} initialDate={today} focusApi={journalApi.focus} onSelectedDateChange={setReportSelectedDate} onDisplayMonthChange={setReportDisplayMonth} /></div>
        ) : view === 'review' && journalApi ? (
          <section className="panel standalone-panel" role="region" aria-label="每日复盘"><DailyReviewEditor api={journalApi.reviews} date={today} /></section>
        ) : view === 'statistics' && journalApi ? (
          <section className="panel standalone-panel" role="region" aria-label="统计概览"><OverviewLoader api={journalApi.statistics} date={today} /></section>
        ) : (
        <div className="dashboard-grid">
          {taskApi ? <TaskWorkspace api={taskApi} initialDate={today} focusApi={journalApi?.focus} onSelectedDateChange={setReportSelectedDate} onDisplayMonthChange={setReportDisplayMonth} /> : <>
          <Panel
            title="今日优先事项"
            ariaLabel="今日优先事项"
            testId="dashboard-region-priority"
            action={<button className="text-action" type="button">＋ 添加事项</button>}
            className="priority-panel"
          >
            <div className="task-list">
              {tasks.map(([title, group, priority]) => (
                <div className="task-row" key={title}>
                  <span className="checkbox" aria-hidden="true" />
                  <span className="task-row__content"><strong>{title}</strong><small>{group}</small></span>
                  <span className={`priority priority--${priority === '紧急' ? 'danger' : priority === '重要' ? 'accent' : 'muted'}`}>{priority}</span>
                </div>
              ))}
            </div>
          </Panel>

          <MonthCalendar
            displayMonth={previewDisplayMonth}
            selectedDate={previewSelectedDate}
            tasks={[]}
            onSelect={(date) => { setPreviewSelectedDate(date); setReportSelectedDate(date); }}
            onDisplayMonthChange={(month) => { setPreviewDisplayMonth(month); setReportDisplayMonth(month); }}
            onToday={() => {
              setPreviewSelectedDate(today);
              setPreviewDisplayMonth(today.slice(0, 7));
            }}
            testId="dashboard-region-calendar"
          />
          </>}

          <Panel title="今日概览" ariaLabel="今日概览" testId="dashboard-region-overview" className="overview-panel">
            {journalApi ? <OverviewLoader api={journalApi.statistics} date={today} /> :
            <div className="overview-list">
              {overview.map(([label, value], index) => (
                <div className="overview-row" key={label}>
                  <span className="overview-row__icon" aria-hidden="true" />
                  <span>{label}</span>
                  <strong>{value}</strong>
                  <span className="progress"><i style={{ width: `${[75, 68, 75, 44][index]}%` }} /></span>
                </div>
              ))}
            </div>}
          </Panel>

          <Panel title="今日复盘" ariaLabel="今日复盘" testId="dashboard-region-review" className="review-panel">
            {journalApi ? <DailyReviewEditor api={journalApi.reviews} date={today} /> :
            <div className="review-grid">
              {reviewSections.map((section) => (
                <div className="review-column" key={section}>
                  <h3><span aria-hidden="true">＋</span>{section}</h3>
                  <i /><i /><i />
                </div>
              ))}
            </div>}
          </Panel>
        </div>
        )}
      </main>
      {journalApi && reportKind && <ReportDialog
        api={journalApi}
        kind={reportKind}
        anchorDate={reportKind === 'weekly' ? reportSelectedDate : `${reportDisplayMonth}-01`}
        now={now}
        onClose={() => setReportKind(null)}
      />}
    </div>
  );
}
