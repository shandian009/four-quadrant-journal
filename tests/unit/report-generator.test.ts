import { describe, expect, it } from 'vitest';
import type { DailyReview, Task } from '../../src/shared/domain';
import { reportPeriod } from '../../src/renderer/features/reports/report-period';
import { generateLocalReport } from '../../src/renderer/features/reports/report-generator';

function task(overrides: Partial<Task> & Pick<Task, 'id' | 'title' | 'plannedDate'>): Task {
  return {
    notes: '',
    quadrant: 'important',
    dueAt: null,
    remindAt: null,
    estimatedMinutes: null,
    status: 'active',
    manualStruck: false,
    sortOrder: 0,
    completedAt: null,
    createdAt: `${overrides.plannedDate}T01:00:00.000Z`,
    updatedAt: `${overrides.plannedDate}T01:00:00.000Z`,
    ...overrides
  };
}

function review(date: string, wins: string, improvements: string, tomorrowFocus: string): DailyReview {
  return {
    id: `review-${date}`,
    reviewDate: date,
    wins,
    improvements,
    tomorrowFocus,
    createdAt: `${date}T01:00:00.000Z`,
    updatedAt: `${date}T01:00:00.000Z`
  };
}

function chineseCharacters(text: string): number {
  return [...text].filter((character) => /\p{Script=Han}/u.test(character)).length;
}

const tasks = [
  task({ id: '1', title: '完成客户迁移方案', plannedDate: '2026-07-06', quadrant: 'urgent_important', status: 'completed', completedAt: '2026-07-06T08:00:00.000Z' }),
  task({ id: '2', title: '整理产品路线图', plannedDate: '2026-07-08', quadrant: 'important', status: 'completed', completedAt: '2026-07-09T08:00:00.000Z' }),
  task({ id: '3', title: '确认供应商延期风险', plannedDate: '2026-07-12', quadrant: 'urgent_important' }),
  task({ id: '4', title: '准备月度经营复盘', plannedDate: '2026-07-20', quadrant: 'important' }),
  task({ id: '5', title: '清理历史资料', plannedDate: '2026-07-29', quadrant: 'neither', status: 'completed', completedAt: '2026-07-29T08:00:00.000Z' })
];

const reviews = [
  review('2026-07-07', '客户迁移范围已经确认', '风险同步还可以更早', '先处理供应商延期风险'),
  review('2026-07-22', '经营复盘数据已经收齐', '跨团队反馈等待较久', '完成经营复盘并明确下月重点')
];

describe('reportPeriod', () => {
  it('returns the inclusive Monday through Sunday containing the anchor date', () => {
    expect(reportPeriod('weekly', '2026-07-12')).toEqual({
      startDate: '2026-07-06',
      endDate: '2026-07-12',
      title: '周报（2026-07-06 至 2026-07-12）',
      suggestedName: '四象日志-周报-2026-07-06.txt'
    });
  });

  it('returns the full displayed month including leap-day boundaries', () => {
    expect(reportPeriod('monthly', '2028-02-29')).toEqual({
      startDate: '2028-02-01',
      endDate: '2028-02-29',
      title: '月报（2028-02-01 至 2028-02-29）',
      suggestedName: '四象日志-月报-2028-02.txt'
    });
  });
});

describe('generateLocalReport', () => {
  it('uses only real weekly records, reports exact totals, and stays within 180–240 Chinese characters', () => {
    const generated = generateLocalReport({
      kind: 'weekly',
      startDate: '2026-07-06',
      endDate: '2026-07-12',
      tasks,
      reviews
    }, () => new Date('2030-01-02T03:04:05.000Z'));

    expect(generated.generatedAt).toBe('2030-01-02T03:04:05.000Z');
    expect(generated.text).toContain('事项共3项，完成2项');
    expect(generated.text).toContain('完成客户迁移方案');
    expect(generated.text).toContain('确认供应商延期风险');
    expect(generated.text).not.toContain('准备月度经营复盘');
    expect(generated.text).not.toContain('取得突破');
    expect(chineseCharacters(generated.text)).toBeGreaterThanOrEqual(180);
    expect(chineseCharacters(generated.text)).toBeLessThanOrEqual(240);
  });

  it('builds a factual month report with distribution, weekly progress and 540–660 Chinese characters', () => {
    const generated = generateLocalReport({
      kind: 'monthly',
      startDate: '2026-07-01',
      endDate: '2026-07-31',
      tasks,
      reviews
    }, () => new Date('2030-01-02T03:04:05.000Z'));

    expect(generated.text).toContain('事项共5项，完成3项');
    expect(generated.text).toContain('完成客户迁移方案');
    expect(generated.text).toContain('准备月度经营复盘');
    expect(generated.text).toContain('第一周');
    expect(generated.text).toContain('重要且紧急2项');
    expect(generated.text).not.toContain('不存在的成果');
    expect(chineseCharacters(generated.text)).toBeGreaterThanOrEqual(540);
    expect(chineseCharacters(generated.text)).toBeLessThanOrEqual(660);
  });

  it('keeps at least one complete real achievement when several medium-length weekly titles do not fit together', () => {
    const achievementTitles = [
      '完成跨部门客户迁移方案并核对历史数据归档规则与异常记录处理流程确保后续交付可以按计划稳定推进',
      '整理下半年产品路线图并完成业务目标技术依赖与交付节点的逐项核对为后续排期提供准确依据',
      '完成重点合作伙伴服务升级并验证权限配置监控告警与应急回退方案确保上线后可以持续跟踪运行状态'
    ].map((title) => `${title}${'同时补充负责人验收标准与书面交接记录'.repeat(2)}`);
    const generated = generateLocalReport({
      kind: 'weekly',
      startDate: '2026-07-06',
      endDate: '2026-07-12',
      tasks: achievementTitles.map((title, index) => task({
        id: `achievement-${index}`,
        title,
        plannedDate: '2026-07-06',
        quadrant: index === 0 ? 'urgent_important' : 'important',
        status: 'completed',
        completedAt: '2026-07-06T08:00:00.000Z'
      })),
      reviews: []
    });

    const quotedTitles = [...generated.text.matchAll(/“([^”]+)”/g)].map((match) => match[1]);
    expect(generated.text).toContain('主要成果：');
    expect(quotedTitles.length).toBeGreaterThanOrEqual(1);
    expect(quotedTitles.length).toBeLessThan(achievementTitles.length);
    expect(quotedTitles.every((title) => achievementTitles.includes(title))).toBe(true);
    expect(generated.text.split('\n\n').every((paragraph) => /[。！？]$/.test(paragraph))).toBe(true);
    expect(chineseCharacters(generated.text)).toBeGreaterThanOrEqual(180);
    expect(chineseCharacters(generated.text)).toBeLessThanOrEqual(240);
  });

  it('keeps at least one complete real risk when several medium-length monthly titles do not fit together', () => {
    const riskTitles = [
      '确认供应商延期影响范围并补充替代交付路径责任人与每日跟进节点避免关键物料缺口影响版本发布',
      '处理跨团队接口联调阻塞问题并明确测试环境数据准备与缺陷修复时间避免验收窗口继续向后顺延',
      '完成历史账号权限复核并确认离职人员访问回收日志留存与异常告警处置进度降低后续审计风险',
      '跟进月度经营数据口径差异并逐项核对收入成本与资源投入记录避免错误结论影响下月决策',
      '确认重点客户续约流程中尚未关闭的合同条款开票信息与服务承诺并按责任分工持续跟进',
      '排查生产监控告警噪声并重新确认阈值通知对象与升级路径避免真实故障被大量重复消息淹没'
    ].map((title) => `${title}${'同时补充责任人处置时限验证证据与逐日升级机制作为后续核对依据'.repeat(3)}`);
    const generated = generateLocalReport({
      kind: 'monthly',
      startDate: '2026-07-01',
      endDate: '2026-07-31',
      tasks: riskTitles.map((title, index) => task({
        id: `risk-${index}`,
        title,
        plannedDate: `2026-07-${String(index + 1).padStart(2, '0')}`,
        quadrant: index % 2 === 0 ? 'urgent_important' : 'important'
      })),
      reviews: []
    });

    const quotedTitles = [...generated.text.matchAll(/“([^”]+)”/g)].map((match) => match[1]);
    expect(generated.text).toContain('未完成事项与风险：');
    expect(quotedTitles.length).toBeGreaterThanOrEqual(1);
    expect(quotedTitles.length).toBeLessThan(riskTitles.length);
    expect(quotedTitles.every((title) => riskTitles.includes(title))).toBe(true);
    expect(generated.text.split('\n\n').every((paragraph) => /[。！？]$/.test(paragraph))).toBe(true);
    expect(chineseCharacters(generated.text)).toBeGreaterThanOrEqual(540);
    expect(chineseCharacters(generated.text)).toBeLessThanOrEqual(660);
  });

  it.each(['weekly', 'monthly'] as const)('is honest for empty %s data and states that records are sparse', (kind) => {
    const period = kind === 'weekly'
      ? { startDate: '2026-07-06', endDate: '2026-07-12' }
      : { startDate: '2026-07-01', endDate: '2026-07-31' };
    const generated = generateLocalReport({ kind, ...period, tasks: [], reviews: [] }, () => new Date('2030-01-02T03:04:05.000Z'));

    expect(generated.text).toContain('本周期记录较少');
    expect(generated.text).toContain('事项共0项，完成0项');
    expect(chineseCharacters(generated.text)).toBeGreaterThanOrEqual(kind === 'weekly' ? 180 : 540);
    expect(chineseCharacters(generated.text)).toBeLessThanOrEqual(kind === 'weekly' ? 240 : 660);
  });
});
