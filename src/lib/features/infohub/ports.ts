import type { VaultId } from "$lib/shared/types/ids";
import type { Overview, SyncStatus } from "./types/infohub";

export type SyncStatusHandlers = {
  on_status: (status: SyncStatus) => void;
  on_error: (error: unknown) => void;
};

export interface InfoHubPort {
  overview(vault_id: VaultId): Promise<Overview>;
  // Reports the current sync status and every later change until stopped.
  watch_sync_status(
    vault_id: VaultId,
    handlers: SyncStatusHandlers,
  ): () => void;
  // The workspace path of an object, or null when the workspace has no
  // object with this id.
  object_path(id: string): Promise<string | null>;
}
