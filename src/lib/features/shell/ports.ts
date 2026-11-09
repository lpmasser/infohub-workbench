import type { VaultId } from "$lib/shared/types/ids";

export interface ShellPort {
  open_url: (url: string) => Promise<void>;
  // Shows a file of the source in a new browser tab.
  open_file: (vault_id: VaultId, path: string) => Promise<void>;
}
