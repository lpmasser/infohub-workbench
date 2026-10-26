import type { Overview, SyncStatus } from "../types/infohub";
export class InfoHubStore {
  overview = $state<Overview | null>(null);
  sync = $state<SyncStatus | null>(null);
  overview_error = $state<string | null>(null);
  sync_error = $state<string | null>(null);
  loading = $state(false);
  reset() {
    this.overview = null;
    this.sync = null;
    this.overview_error = null;
    this.sync_error = null;
    this.loading = false;
  }
}
