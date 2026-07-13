import type { Quadrant, Task } from '../../../shared/domain';

const quadrants: Array<[Quadrant, string]> = [
  ['urgent_important', '重要且紧急'],
  ['important', '重要不紧急'],
  ['urgent', '紧急不重要'],
  ['neither', '不紧急不重要']
];

interface QuadrantBoardProps {
  tasks: Task[];
  onMove(id: string, quadrant: Quadrant): Promise<void>;
  onToggleComplete(task: Task): Promise<void>;
  onToggleManualStrike(task: Task): Promise<void>;
}

export function QuadrantBoard({ tasks, onMove, onToggleComplete, onToggleManualStrike }: QuadrantBoardProps) {
  return (
    <div className="quadrant-board">
      {quadrants.map(([quadrant, label]) => {
        const visibleTasks = tasks.filter((task) => task.quadrant === quadrant && task.status !== 'deleted');
        return (
          <section key={quadrant} aria-label={label} className={`quadrant quadrant--${quadrant}`}>
            <h3>{label}<small>{visibleTasks.length} 项</small></h3>
            {visibleTasks.map((task, index) => (
              <article key={task.id} className={[
                'quadrant-task',
                task.status === 'completed' ? 'quadrant-task--completed' : '',
                task.manualStruck ? 'quadrant-task--manual-struck' : ''
              ].filter(Boolean).join(' ')}>
                <span className="quadrant-task__number">{index + 1}</span>
                <button
                  type="button"
                  className="checkbox"
                  aria-pressed={task.status === 'completed'}
                  aria-label={`${task.status === 'completed' ? '恢复' : '完成'}“${task.title}”`}
                  onClick={() => void onToggleComplete(task)}
                />
                <strong>{task.title}</strong>
                <button
                  type="button"
                  className="quadrant-task__strike"
                  aria-pressed={task.manualStruck}
                  aria-label={`${task.manualStruck ? '取消划线' : '划线'}“${task.title}”`}
                  onClick={() => void onToggleManualStrike(task)}
                >{task.manualStruck ? '取消划线' : '划线'}</button>
                <select aria-label={`移动“${task.title}”`} value={task.quadrant} onChange={(event) => void onMove(task.id, event.target.value as Quadrant)}>
                  {quadrants.map(([value, optionLabel]) => <option key={value} value={value}>{optionLabel}</option>)}
                </select>
              </article>
            ))}
          </section>
        );
      })}
    </div>
  );
}
