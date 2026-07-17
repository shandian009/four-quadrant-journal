import type { DailyReview, Quadrant, Task } from '../../../shared/domain';
import type { ReportKind } from './report-period';

export interface ReportInput {
  kind: ReportKind;
  startDate: string;
  endDate: string;
  tasks: Task[];
  reviews: DailyReview[];
}

export interface GeneratedReport {
  title: string;
  periodLabel: string;
  text: string;
  generatedAt: string;
}

const quadrantLabels: Record<Quadrant, string> = {
  urgent_important: '重要且紧急',
  important: '重要不紧急',
  urgent: '紧急不重要',
  neither: '不重要不紧急'
};

export const WEEKLY_SECTION_TITLES = [
  '本周工作概况',
  '重点成果',
  '工作进展',
  '问题与风险',
  '下周工作计划',
  '复盘总结'
] as const;

function hanLength(value: string): number {
  return [...value].filter((character) => /\p{Script=Han}/u.test(character)).length;
}

function clean(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function dateInRange(date: string, startDate: string, endDate: string): boolean {
  return date >= startDate && date <= endDate;
}

function reviewValues(reviews: DailyReview[], key: 'wins' | 'improvements' | 'tomorrowFocus', limit: number): string {
  return reviews.map((item) => clean(item[key])).filter(Boolean).slice(0, limit).join('；');
}

function localNoon(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function weeklyBreakdown(tasks: Task[], startDate: string): string {
  const start = localNoon(startDate);
  const groups = Array.from({ length: 5 }, () => [] as Task[]);
  for (const task of tasks) {
    const day = localNoon(task.plannedDate);
    const index = Math.min(4, Math.max(0, Math.floor((day.getTime() - start.getTime()) / 604_800_000)));
    groups[index].push(task);
  }
  const names = ['第一周', '第二周', '第三周', '第四周', '第五周'];
  return groups.map((group, index) => {
    const completed = group.filter((item) => item.status === 'completed').length;
    return `${names[index]}记录${group.length}项、完成${completed}项`;
  }).join('；');
}

function factualFillers(input: {
  total: number;
  completed: number;
  pending: number;
  reviewCount: number;
  quadrants: Record<Quadrant, number>;
}): string[] {
  const { total, completed, pending, reviewCount, quadrants } = input;
  return [
    `以上内容仅依据本周期保存的${total}项事项和${reviewCount}条复盘整理，未加入记录之外的成果。`,
    `当前可核对的完成记录为${completed}项，未完成记录为${pending}项，后续可在事项状态变化后重新生成。`,
    `本周期四个象限的记录数量依次为${quadrants.urgent_important}项、${quadrants.important}项、${quadrants.urgent}项和${quadrants.neither}项。`,
    `报告中的判断以已保存标题、完成状态和复盘文字为限，没有记录的进展不作推断。`,
    `后续复盘可继续补充实际收获、改进点和重点事项，使下一次汇总拥有更完整的依据。`,
    `对仍未完成的${pending}项事项，建议结合原始记录逐项确认状态、时间安排与实际风险。`,
    `本地报告不改变事项或复盘数据，重新生成时会按同一日期范围再次读取最新记录。`
  ];
}

interface ReportBlock {
  prefix: string;
  items?: string[];
  separator?: string;
  suffix?: string;
  emptyText?: string;
  required?: boolean;
  minimumItems?: number;
}

function paragraph(text: string, required = false): ReportBlock {
  return { prefix: text, required };
}

function renderBlock(block: ReportBlock): string {
  if (block.items && block.items.length === 0 && block.emptyText) return clean(block.emptyText);
  return clean(`${block.prefix}${block.items?.join(block.separator ?? '') ?? ''}${block.suffix ?? ''}`);
}

function renderBlocks(blocks: ReportBlock[]): string {
  return blocks.map(renderBlock).filter(Boolean).join('\n\n');
}

function fitReport(sourceBlocks: ReportBlock[], min: number, max: number, fillers: string[]): string {
  const blocks = sourceBlocks.map((block) => ({ ...block, items: block.items ? [...block.items] : undefined }));

  // Lists are atomic: trim complete low-priority items from the end before sacrificing a paragraph.
  while (hanLength(renderBlocks(blocks)) > max) {
    const block = [...blocks].reverse().find((candidate) =>
      candidate.items && candidate.items.length > (candidate.minimumItems ?? 0));
    if (!block?.items) break;
    block.items.pop();
  }

  // Preserve the factual summary and one usable title from each real title list before optional detail.
  while (hanLength(renderBlocks(blocks)) > max) {
    let removableIndex = -1;
    for (let index = blocks.length - 1; index >= 0; index -= 1) {
      if (!blocks[index].required) {
        removableIndex = index;
        break;
      }
    }
    if (removableIndex < 0) break;
    blocks.splice(removableIndex, 1);
  }

  // A lone title may itself be too long. Remove it whole and retain the block's explicit factual fallback.
  while (hanLength(renderBlocks(blocks)) > max) {
    const block = [...blocks].reverse().find((candidate) => candidate.items && candidate.items.length > 0);
    if (!block?.items) break;
    block.items.pop();
  }

  let result = renderBlocks(blocks);
  let index = 0;
  while (hanLength(result) < min) {
    const filler = fillers[index % fillers.length];
    const candidate = result ? `${result}\n\n${filler}` : filler;
    if (hanLength(candidate) <= max) {
      result = candidate;
    }
    index += 1;
  }
  return result;
}

const quadrantPriority: Record<Quadrant, number> = {
  urgent_important: 0,
  important: 1,
  urgent: 2,
  neither: 3
};

function byWorkPriority(left: Task, right: Task): number {
  return quadrantPriority[left.quadrant] - quadrantPriority[right.quadrant]
    || left.plannedDate.localeCompare(right.plannedDate)
    || left.sortOrder - right.sortOrder;
}

function numberedTitles(tasks: Task[]): string {
  return tasks.map((task, index) => `${index + 1}. “${clean(task.title)}”`).join('；');
}

function reviewEntries(
  reviews: DailyReview[],
  key: 'wins' | 'improvements' | 'tomorrowFocus',
  limit = 2
): string[] {
  return reviews.map((item) => clean(item[key])).filter(Boolean).slice(0, limit);
}

function sentence(parts: string[]): string {
  const text = parts.filter(Boolean).join('；');
  return text ? `${text.replace(/[。；]+$/u, '')}。` : '暂无相关记录。';
}

function weeklySection(title: typeof WEEKLY_SECTION_TITLES[number], content: string): string {
  return `【${title}】\n${content}`;
}

function generateWeeklyTemplate(input: {
  tasks: Task[];
  reviews: DailyReview[];
  completed: Task[];
  pending: Task[];
  quadrants: Record<Quadrant, number>;
  rate: number;
}): string {
  const { tasks, reviews, completed, pending, quadrants, rate } = input;
  const sparse = tasks.length === 0 && reviews.length === 0;
  const priorityCompleted = completed
    .filter((task) => task.quadrant === 'urgent_important' || task.quadrant === 'important')
    .sort(byWorkPriority)
    .slice(0, 3);
  const priorityCompletedIds = new Set(priorityCompleted.map((task) => task.id));
  const otherCompleted = completed
    .filter((task) => !priorityCompletedIds.has(task.id))
    .sort(byWorkPriority)
    .slice(0, 2);
  const priorityPending = [...pending].sort(byWorkPriority).slice(0, 3);
  const wins = reviewEntries(reviews, 'wins');
  const improvements = reviewEntries(reviews, 'improvements');
  const nextFocus = reviewEntries(reviews, 'tomorrowFocus');
  const summaryDetails: string[] = [];

  const render = () => {
    const importantCount = quadrants.urgent_important + quadrants.important;
    const overview = `${sparse ? '本周期记录较少。' : ''}本周事项共${tasks.length}项，完成${completed.length}项，完成率${rate}%，未完成${pending.length}项；其中重要相关事项${importantCount}项。`;
    const achievement = priorityCompleted.length
      ? sentence([`本周重点成果为${numberedTitles(priorityCompleted)}`])
      : '暂无相关记录。';
    const progress = sentence([
      otherCompleted.length ? `其他已完成事项包括${numberedTitles(otherCompleted)}` : '',
      wins.length ? `复盘记录的本周收获包括${wins.join('、')}` : ''
    ]);
    const risks = sentence([
      priorityPending.length ? `尚未完成并需继续关注的事项包括${numberedTitles(priorityPending)}` : '',
      improvements.length ? `已记录的改进点包括${improvements.join('、')}` : ''
    ]);
    const plan = sentence([
      priorityPending.length ? `下周优先推进${numberedTitles(priorityPending)}` : '',
      nextFocus.length ? `复盘中明确的后续重点包括${nextFocus.join('、')}` : ''
    ]);
    const summary = sentence([
      sparse
        ? '当前没有可用于总结的事项或复盘内容，建议先补充真实记录后重新生成'
        : `本周报告依据${tasks.length}项事项和${reviews.length}条复盘生成，所有成果、风险及计划均来自已保存记录`,
      ...summaryDetails
    ]);
    return [
      weeklySection('本周工作概况', overview),
      weeklySection('重点成果', achievement),
      weeklySection('工作进展', progress),
      weeklySection('问题与风险', risks),
      weeklySection('下周工作计划', plan),
      weeklySection('复盘总结', summary)
    ].join('\n\n');
  };

  const removable = [otherCompleted, priorityPending, priorityCompleted, nextFocus, improvements, wins];
  let text = render();
  while (hanLength(text) > 340) {
    const list = removable.find((items) => items.length > 0);
    if (!list) break;
    list.pop();
    text = render();
  }

  if (!sparse) {
    const fillers = factualFillers({
      total: tasks.length,
      completed: completed.length,
      pending: pending.length,
      reviewCount: reviews.length,
      quadrants
    });
    for (const filler of fillers) {
      if (hanLength(text) >= 260) break;
      summaryDetails.push(filler);
      const candidate = render();
      if (hanLength(candidate) <= 340) text = candidate;
      else summaryDetails.pop();
    }
  }

  return text;
}

export function generateLocalReport(input: ReportInput, now: () => Date = () => new Date()): GeneratedReport {
  const tasks = input.tasks.filter((task) => task.status !== 'deleted' && dateInRange(task.plannedDate, input.startDate, input.endDate));
  const reviews = input.reviews.filter((review) => dateInRange(review.reviewDate, input.startDate, input.endDate));
  const completed = tasks.filter((task) => task.status === 'completed');
  const pending = tasks.filter((task) => task.status !== 'completed');
  const quadrants = tasks.reduce<Record<Quadrant, number>>((counts, task) => {
    counts[task.quadrant] += 1;
    return counts;
  }, { urgent_important: 0, important: 0, urgent: 0, neither: 0 });
  const rate = tasks.length === 0 ? 0 : Math.round(completed.length / tasks.length * 100);
  const sparse = tasks.length === 0 && reviews.length === 0 ? '本周期记录较少。' : '';
  const priorityAchievements = completed.filter((task) => task.quadrant === 'urgent_important' || task.quadrant === 'important');
  const overview = `${sparse}本周期事项共${tasks.length}项，完成${completed.length}项，完成率${rate}%，未完成${pending.length}项。`;
  const achievementItems = priorityAchievements
    .slice(0, input.kind === 'weekly' ? 3 : 6)
    .map((task) => `“${clean(task.title)}”`);
  const achievements: ReportBlock = {
    prefix: '主要成果：已完成',
    items: achievementItems,
    separator: '、',
    suffix: '，均来自重要相关象限的真实完成记录。',
    emptyText: priorityAchievements.length
      ? '主要成果：当前没有可完整引用的重要相关已完成事项标题，不对成果作额外推断。'
      : '主要成果：当前没有重要相关象限的已完成事项记录，不对成果作额外推断。',
    required: true,
    minimumItems: achievementItems.length > 0 ? 1 : 0
  };
  const riskItems = pending
    .slice(0, input.kind === 'weekly' ? 3 : 6)
    .map((task) => `“${clean(task.title)}”`);
  const risks: ReportBlock = {
    prefix: '未完成事项与风险：',
    items: riskItems,
    separator: '、',
    suffix: '仍未完成，需要依据原记录继续确认进度与延期风险。',
    emptyText: pending.length
      ? '未完成事项与风险：当前没有可完整引用的未完成事项标题，需要依据原记录继续确认。'
      : '未完成事项与风险：当前范围内没有未完成事项记录，仍需以后续实际变化为准。',
    required: true,
    minimumItems: riskItems.length > 0 ? 1 : 0
  };
  const wins = reviewValues(reviews, 'wins', input.kind === 'weekly' ? 2 : 4);
  const improvements = reviewValues(reviews, 'improvements', input.kind === 'weekly' ? 2 : 4);
  const focus = reviewValues(reviews, 'tomorrowFocus', input.kind === 'weekly' ? 2 : 4);
  const insights = `复盘记录：收获${wins ? `包括${wins}` : '暂未填写'}；改进${improvements ? `包括${improvements}` : '暂未填写'}；后续重点${focus ? `包括${focus}` : '暂未填写'}。`;

  const periodLabel = `${input.startDate} 至 ${input.endDate}`;
  if (input.kind === 'weekly') {
    return {
      title: `周报（${periodLabel}）`,
      periodLabel,
      text: generateWeeklyTemplate({ tasks, reviews, completed, pending, quadrants, rate }),
      generatedAt: now().toISOString()
    };
  }

  const paragraphs: ReportBlock[] = [
        paragraph(overview, true),
        achievements,
        paragraph(`四象限分布：${(Object.keys(quadrantLabels) as Quadrant[]).map((key) => `${quadrantLabels[key]}${quadrants[key]}项`).join('，')}。完成趋势只能依据当前保存的完成状态判断。`),
        paragraph(`按周进展：${weeklyBreakdown(tasks, input.startDate)}。各周摘要仅统计计划日期落在本月的事项。`),
        risks,
        paragraph(`复盘观察：${insights}共读取${reviews.length}条复盘，不对空白内容进行补写。`),
        paragraph(`下月建议与重点：优先复核${pending.length}项未完成记录，并以已填写的后续重点为依据安排；若重点为空，则先补充复盘后再作决定。`)
      ];
  const fillers = factualFillers({ total: tasks.length, completed: completed.length, pending: pending.length, reviewCount: reviews.length, quadrants });
  return {
    title: `月报（${periodLabel}）`,
    periodLabel,
    text: fitReport(paragraphs, 540, 660, fillers),
    generatedAt: now().toISOString()
  };
}
