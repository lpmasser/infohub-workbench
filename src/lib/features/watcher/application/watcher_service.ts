import type { WatcherPort } from "$lib/features/watcher/ports";
import type { VaultFsEvent } from "$lib/features/watcher/types/watcher";
import type { VaultId } from "$lib/shared/types/ids";
import { create_logger } from "$lib/shared/utils/logger";

const log = create_logger("watcher_service");

export class WatcherService {
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly port: WatcherPort,
    private readonly synchronize_index: (vault_id: VaultId) => Promise<void>,
  ) {}

  private pending_indexes = new Set<VaultId>();
  private running_indexes = new Set<VaultId>();

  // A change arriving during a scan must cause another pass, not be dropped.
  async refresh_index(vault_id: VaultId): Promise<void> {
    this.pending_indexes.add(vault_id);
    if (this.running_indexes.has(vault_id)) return;
    this.running_indexes.add(vault_id);
    try {
      while (this.pending_indexes.delete(vault_id)) {
        await this.synchronize_index(vault_id);
      }
    } catch (error) {
      log.from_error("External change index refresh failed", error);
    } finally {
      this.running_indexes.delete(vault_id);
    }
  }

  async start(vault_id: VaultId): Promise<void> {
    await this.stop();
    try {
      await this.port.watch_vault(vault_id);
    } catch (error) {
      log.from_error("Failed to start vault watcher", error);
    }
  }

  async stop(): Promise<void> {
    this.unsubscribe?.();
    this.unsubscribe = null;
    try {
      await this.port.unwatch_vault();
    } catch (error) {
      log.from_error("Failed to stop vault watcher", error);
    }
  }

  subscribe(handler: (event: VaultFsEvent) => void): () => void {
    this.unsubscribe?.();
    const unsub = this.port.subscribe_fs_events(handler);
    this.unsubscribe = unsub;
    return unsub;
  }
}
