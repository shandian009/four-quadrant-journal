import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { DesktopWindowState, WindowApi } from '../../src/shared/ipc';
import { WorkbenchToolbar } from '../../src/renderer/features/toolbar/WorkbenchToolbar';

function api(initial: DesktopWindowState = { mode: 'normal', opacity: 1 }): WindowApi {
  return {
    getDesktopState: vi.fn().mockResolvedValue(initial),
    enterDesktopMode: vi.fn().mockResolvedValue({ mode: 'desktop', opacity: .85 }),
    exitDesktopMode: vi.fn().mockResolvedValue({ mode: 'normal', opacity: 1 }),
    setDesktopOpacity: vi.fn().mockImplementation(async (opacity: number) => ({ ...initial, opacity }))
  };
}

function renderToolbar(windowApi: WindowApi) {
  return render(<WorkbenchToolbar
    themeId="monday"
    selection="monday"
    windowApi={windowApi}
    onThemeChange={() => undefined}
  />);
}

describe('desktop toolbar controls', () => {
  it('loads state, keeps opacity available, then shows the desktop placement', async () => {
    const user = userEvent.setup();
    const windowApi = api();
    let resolve!: (state: DesktopWindowState) => void;
    vi.mocked(windowApi.enterDesktopMode).mockReturnValue(new Promise((done) => { resolve = done; }));
    renderToolbar(windowApi);
    const toggle = await screen.findByRole('button', { name: '嵌入桌面' });

    await user.click(toggle);
    expect(toggle).toBeDisabled();
    resolve({ mode: 'desktop', opacity: .85 });

    expect(await screen.findByRole('button', { name: '恢复窗口' })).toBeEnabled();
    expect(screen.getByRole('slider', { name: '窗口透明度' })).toHaveValue('0.85');
  });

  it('allows opacity adjustment and reset in normal mode', async () => {
    const user = userEvent.setup();
    const windowApi = api();
    renderToolbar(windowApi);
    const slider = await screen.findByRole('slider', { name: '窗口透明度' });

    expect(slider).toHaveValue('1');
    expect(screen.getByText('100%')).toBeInTheDocument();
    fireEvent.change(slider, { target: { value: '0.6' } });
    expect(screen.getByText('60%')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '恢复完全不透明' }));

    await waitFor(() => expect(windowApi.setDesktopOpacity).toHaveBeenCalledWith(1));
  });

  it('debounces opacity persistence by 150ms', async () => {
    const windowApi = api({ mode: 'desktop', opacity: .85 });
    renderToolbar(windowApi);
    const slider = await screen.findByRole('slider', { name: '窗口透明度' });
    vi.useFakeTimers();
    try {
      fireEvent.change(slider, { target: { value: '0.6' } });
      expect(windowApi.setDesktopOpacity).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(149);
      expect(windowApi.setDesktopOpacity).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(windowApi.setDesktopOpacity).toHaveBeenCalledWith(.6);
    } finally {
      vi.useRealTimers();
    }
  });

  it('refreshes state and shows the Chinese recovery message after an IPC error', async () => {
    const user = userEvent.setup();
    const windowApi = api();
    vi.mocked(windowApi.enterDesktopMode).mockRejectedValue(new Error('未能嵌入桌面，已恢复普通窗口'));
    vi.mocked(windowApi.getDesktopState)
      .mockResolvedValueOnce({ mode: 'normal', opacity: 1 })
      .mockResolvedValueOnce({ mode: 'normal', opacity: 1 });
    renderToolbar(windowApi);

    await user.click(await screen.findByRole('button', { name: '嵌入桌面' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('未能嵌入桌面，已恢复普通窗口');
    await waitFor(() => expect(windowApi.getDesktopState).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('slider', { name: '窗口透明度' })).toBeInTheDocument();
  });

  it('shows compatibility placement returned by Windows', async () => {
    const user = userEvent.setup();
    const windowApi = api();
    vi.mocked(windowApi.enterDesktopMode).mockResolvedValue({
      mode: 'desktop', opacity: .85, placement: 'compatible'
    });
    renderToolbar(windowApi);

    await user.click(await screen.findByRole('button', { name: '嵌入桌面' }));

    expect(await screen.findByText('桌面兼容模式')).toBeInTheDocument();
  });

  it('passes through a recoverable exit failure with an actionable tray retry message', async () => {
    const user = userEvent.setup();
    const windowApi = api({ mode: 'desktop', opacity: .85 });
    vi.mocked(windowApi.exitDesktopMode).mockRejectedValue(new Error('恢复失败，请从托盘重试'));
    vi.mocked(windowApi.getDesktopState)
      .mockResolvedValueOnce({ mode: 'desktop', opacity: .85 })
      .mockResolvedValueOnce({ mode: 'desktop', opacity: 1 });
    renderToolbar(windowApi);

    await user.click(await screen.findByRole('button', { name: '恢复窗口' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('恢复失败，请从托盘重试');
    expect(screen.getByRole('button', { name: '恢复窗口' })).toBeEnabled();
  });
});
