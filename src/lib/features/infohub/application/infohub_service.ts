import type { InfoHubPort } from "../ports";
import type { InfoHubStore } from "../state/infohub_store.svelte";
import type { VaultId } from "$lib/shared/types/ids";
export class InfoHubService {
  private generation = 0;
  private overview_busy = false;
  private overview_pending = false;
  private sync_busy = false;
  private vault_id: VaultId | null = null;
  constructor(
    private readonly port: InfoHubPort,
    private readonly store: InfoHubStore,
  ) {}
  select(vault_id: VaultId | null) {
    this.generation++;
    this.vault_id = vault_id;
    this.overview_busy = false;
    this.overview_pending = false;
    this.sync_busy = false;
    this.store.reset();
  }
  async refresh_overview(): Promise<void> {
    if (!this.vault_id) return;
    this.overview_pending = true;
    if (this.overview_busy) return;
    this.overview_busy = true;
    this.store.loading = true;
    const generation = this.generation;
    const vault_id = this.vault_id;
    // File events that arrive during a query need another snapshot now that
    // there is no polling pass to pick them up later.
    do {
      this.overview_pending = false;
      try {
        const overview = await this.port.overview(vault_id);
        if (generation !== this.generation) return;
        this.store.overview = overview;
        this.store.overview_error = null;
      } catch (error) {
        if (generation !== this.generation) return;
        this.store.overview_error = String(error);
      }
    } while (this.overview_pending);
    this.overview_busy = false;
    this.store.loading = false;
  }
  async refresh_sync(): Promise<void> {
    if (this.sync_busy || !this.vault_id) return;
    this.sync_busy = true;
    const generation = this.generation;
    try {
      const sync = await this.port.sync_status(this.vault_id);
      if (generation !== this.generation) return;
      this.store.sync = sync;
      this.store.sync_error = null;
    } catch (error) {
      if (generation !== this.generation) return;
      this.store.sync = null;
      this.store.sync_error = String(error);
    } finally {
      if (generation === this.generation) this.sync_busy = false;
    }
  }
}
