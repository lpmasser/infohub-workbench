import type { VaultId, VaultPath } from "$lib/shared/types/ids";

export type Vault = {
  id: VaultId;
  path: VaultPath;
  name: string;
  created_at: number;
  last_opened_at?: number | null;
  note_count?: number | null;
  // Sources other than the user's workspace cannot be written.
  read_only?: boolean;
  // What the source is (writable, commit, draft state), shown when switching.
  description?: string;
};
