import { useEffect, useRef, useState } from 'react';
import type { ReviewApi, SaveReviewDto } from '../../../shared/ipc';

const EMPTY: SaveReviewDto = { wins: '', improvements: '', tomorrowFocus: '' };

export function DailyReviewEditor({ api, date }: { api: ReviewApi; date: string }) {
  const [draft, setDraft] = useState(EMPTY);
  const [saved, setSaved] = useState(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const currentDraft = useRef(draft);
  currentDraft.current = draft;

  useEffect(() => {
    let active = true;
    setLoaded(false);
    setStatus('idle');
    void api.get(date).then((review) => {
      if (!active) return;
      const value = review ? {
        wins: review.wins,
        improvements: review.improvements,
        tomorrowFocus: review.tomorrowFocus
      } : EMPTY;
      setDraft(value);
      setSaved(value);
      setLoaded(true);
    });
    return () => { active = false; };
  }, [api, date]);

  async function saveNow(value = currentDraft.current) {
    setStatus('saving');
    try {
      await api.save(date, value);
      setSaved(value);
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  }

  useEffect(() => {
    if (!loaded || JSON.stringify(draft) === JSON.stringify(saved)) return;
    const timer = window.setTimeout(() => void saveNow(draft), 500);
    return () => window.clearTimeout(timer);
  }, [draft, loaded, saved]);

  const fields: Array<[keyof SaveReviewDto, string]> = [
    ['wins', '今日收获'],
    ['improvements', '待改进'],
    ['tomorrowFocus', '明日重点']
  ];

  return (
    <div className="review-editor">
      <div className="review-grid">
        {fields.map(([key, label]) => (
          <label className="review-column" key={key}>
            <span className="review-column__title"><i aria-hidden="true">＋</i>{label}</span>
            <textarea aria-label={label} value={draft[key]} onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))} />
          </label>
        ))}
      </div>
      <div className={`save-state save-state--${status}`}>
        {status === 'saving' && '保存中…'}
        {status === 'saved' && '已保存'}
        {status === 'error' && <button type="button" onClick={() => void saveNow()}>未保存，点击重试</button>}
      </div>
    </div>
  );
}
