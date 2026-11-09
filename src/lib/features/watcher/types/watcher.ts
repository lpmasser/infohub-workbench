/**
 * Change in the open vault: single files, or "resynced" when the event stream
 * lost track and every displayed snapshot has to be read again.
 */
export type VaultFsEvent =
  | {
      type: "note_changed_externally";
      vault_id: string;
      note_path: string;
    }
  | {
      type: "note_added";
      vault_id: string;
      note_path: string;
    }
  | {
      type: "note_removed";
      vault_id: string;
      note_path: string;
    }
  | {
      type: "vault_resynced";
      vault_id: string;
    };
