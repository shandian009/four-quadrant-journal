export const RECOVERY_IPC_CHANNEL = 'desktop-recovery:restore';

export type RecoveryIpcListener = (event: { sender: unknown }) => void;

export interface RecoveryIpcBus {
  on(channel: string, listener: RecoveryIpcListener): void;
  removeListener(channel: string, listener: RecoveryIpcListener): void;
}

export function registerScopedRecoveryIpc(
  bus: RecoveryIpcBus,
  allowedSender: unknown,
  restore: () => void
): () => void {
  const listener: RecoveryIpcListener = (event) => {
    if (event.sender !== allowedSender) return;
    restore();
  };
  bus.on(RECOVERY_IPC_CHANNEL, listener);
  return () => bus.removeListener(RECOVERY_IPC_CHANNEL, listener);
}
