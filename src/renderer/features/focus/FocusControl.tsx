import { useEffect, useState } from 'react';
import type { FocusApi, FocusSession } from '../../../shared/ipc';

export function FocusControl({ api, taskId }: { api: FocusApi; taskId: string | null }) {
  const [session, setSession] = useState<FocusSession | null>(null);
  useEffect(() => { void api.current().then(setSession); }, [api]);

  if (!session || session.state === 'finished') {
    return <button className="focus-button" type="button" onClick={async () => setSession(await api.start(taskId))}>开始专注</button>;
  }

  return (
    <span className="focus-controls">
      {session.state === 'running'
        ? <button type="button" onClick={async () => setSession(await api.pause(session.id))}>暂停</button>
        : <button type="button" onClick={async () => setSession(await api.resume(session.id))}>继续</button>}
      <button type="button" onClick={async () => { await api.finish(session.id); setSession(null); }}>结束专注</button>
    </span>
  );
}
