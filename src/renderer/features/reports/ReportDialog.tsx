import { useEffect, useRef, useState } from 'react';
import type { JournalApi } from '../../../shared/ipc';
import { generateLocalReport, type GeneratedReport } from './report-generator';
import { reportPeriod, type ReportKind } from './report-period';

export interface ReportEnhancer {
  enhance(text: string): Promise<{ configured: boolean; text: string }>;
}

export const unconfiguredReportEnhancer: ReportEnhancer = {
  async enhance(text) {
    return { configured: false, text };
  }
};

export function ReportDialog({
  api,
  kind,
  anchorDate,
  now = () => new Date(),
  enhancer = unconfiguredReportEnhancer,
  onClose
}: {
  api: JournalApi;
  kind: ReportKind;
  anchorDate: string;
  now?: () => Date;
  enhancer?: ReportEnhancer;
  onClose(): void;
}) {
  const period = reportPeriod(kind, anchorDate);
  const [report, setReport] = useState<GeneratedReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const generation = useRef(0);

  async function generate() {
    const currentGeneration = ++generation.current;
    setLoading(true);
    setError(null);
    setStatus(null);
    try {
      const [tasks, reviews] = await Promise.all([
        api.tasks.listByRange(period.startDate, period.endDate),
        api.reviews.listByRange(period.startDate, period.endDate)
      ]);
      if (currentGeneration !== generation.current) return;
      setReport(generateLocalReport({ kind, startDate: period.startDate, endDate: period.endDate, tasks, reviews }, now));
    } catch {
      if (currentGeneration === generation.current) setError('报告生成失败，请重试');
    } finally {
      if (currentGeneration === generation.current) setLoading(false);
    }
  }

  useEffect(() => {
    void generate();
    return () => { generation.current += 1; };
  }, [api, kind, period.startDate, period.endDate]);

  async function copy() {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(report.text);
      setStatus('已复制报告');
    } catch {
      setStatus('复制失败，请手动选择文本');
    }
  }

  async function exportText() {
    if (!report) return;
    setError(null);
    try {
      const path = await api.reports.exportText(period.suggestedName, report.text);
      if (path) setStatus('报告已导出');
    } catch {
      setError('导出失败，请重试');
    }
  }

  async function enhance() {
    if (!report) return;
    const result = await enhancer.enhance(report.text);
    if (!result.configured) {
      setStatus('尚未配置 AI 服务，本地报告不受影响');
      return;
    }
    setReport({ ...report, text: result.text });
  }

  return (
    <div className="report-dialog__backdrop">
      <section className="report-dialog" role="dialog" aria-modal="true" aria-labelledby="report-dialog-title">
        <header>
          <div>
            <h2 id="report-dialog-title">{period.title}</h2>
            {report && <p>生成时间：{report.generatedAt.replace('T', ' ').slice(0, 19)}</p>}
          </div>
          <button type="button" aria-label="关闭报告" onClick={onClose}>×</button>
        </header>
        {loading && !report && <p>正在生成本地报告…</p>}
        {report && <textarea aria-label="报告正文" readOnly value={report.text} />}
        {error && <p role="alert">{error}</p>}
        {status && <p role="status">{status}</p>}
        <footer>
          <button type="button" disabled={!report || loading} onClick={() => void copy()}>复制</button>
          <button type="button" disabled={!report || loading} onClick={() => void exportText()}>导出 TXT</button>
          <button type="button" disabled={!report || loading} onClick={() => void enhance()}>AI 润色</button>
          <button type="button" disabled={loading} onClick={() => void generate()}>重新生成</button>
        </footer>
      </section>
    </div>
  );
}
