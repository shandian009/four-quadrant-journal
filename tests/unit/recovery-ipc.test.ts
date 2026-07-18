import { describe, expect, it, vi } from 'vitest';
import { registerScopedRecoveryIpc, type RecoveryIpcBus } from '../../src/main/recovery-ipc';

class FakeIpcBus implements RecoveryIpcBus {
  private listeners = new Map<string, Set<(event: { sender: unknown }) => void>>();

  on(channel: string, listener: (event: { sender: unknown }) => void): void {
    const listeners = this.listeners.get(channel) ?? new Set();
    listeners.add(listener);
    this.listeners.set(channel, listeners);
  }

  removeListener(channel: string, listener: (event: { sender: unknown }) => void): void {
    this.listeners.get(channel)?.delete(listener);
  }

  emit(channel: string, sender: unknown): void {
    this.listeners.get(channel)?.forEach((listener) => listener({ sender }));
  }
}

describe('scoped desktop recovery IPC', () => {
  it('accepts only the recovery window sender and unregisters cleanly', () => {
    const bus = new FakeIpcBus();
    const recoverySender = {};
    const restore = vi.fn();
    const unsubscribe = registerScopedRecoveryIpc(bus, recoverySender, restore);

    bus.emit('desktop-recovery:restore', {});
    expect(restore).not.toHaveBeenCalled();

    bus.emit('desktop-recovery:restore', recoverySender);
    expect(restore).toHaveBeenCalledOnce();

    unsubscribe();
    bus.emit('desktop-recovery:restore', recoverySender);
    expect(restore).toHaveBeenCalledOnce();
  });
});
