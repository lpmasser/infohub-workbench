import type { VaultId } from "$lib/shared/types/ids";
import type { Overview, SyncStatus } from "./types/infohub";
export interface InfoHubPort {
  overview(vault_id: VaultId): Promise<Overview>;
  sync_status(vault_id: VaultId): Promise<SyncStatus>;
}
