/**
 * Change in the open vault. The desktop watcher reports single files; the web
 * event stream can also report that it lost track ("resynced"), after which
 * every displayed snapshot has to be read again.
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
