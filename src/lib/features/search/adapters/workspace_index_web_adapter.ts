import type { WorkspaceIndexPort } from "$lib/features/search/ports";
import type { WebFiles } from "$lib/shared/adapters/web/web_files";
import type { IndexProgressEvent } from "$lib/shared/types/search";

// The web page keeps no search index: the server searches, and the "index"
// is the source's file tree. Re-reading the tree reports progress like an
// index run, so the views that wait for a finished index refresh as usual.
export function create_workspace_index_web_adapter(
  files: WebFiles,
): WorkspaceIndexPort {
  const listeners = new Set<(event: IndexProgressEvent) => void>();
  const emit = (event: IndexProgressEvent) => {
    for (const listener of listeners) listener(event);
  };

  async function sync_index(vault_id: string): Promise<void> {
    const started = Date.now();
    emit({ status: "started", vault_id, total: 0 });
    try {
      const tree = await files.tree(vault_id);
      emit({
        status: "completed",
        vault_id,
        indexed: tree.files.size,
        elapsed_ms: Date.now() - started,
      });
    } catch (error) {
      emit({ status: "failed", vault_id, error: String(error) });
      throw error;
    }
  }

  const changed = (vault_id: string) => {
    files.invalidate_tree(vault_id);
    return Promise.resolve();
  };

  return {
    cancel_index: () => Promise.resolve(),
    sync_index,
    rebuild_index(vault_id) {
      files.invalidate_tree(vault_id);
      return sync_index(vault_id);
    },
    async list_note_paths_by_prefix(vault_id, prefix) {
      const tree = await files.tree(vault_id);
      return [...tree.files.keys()].filter(
        (path) => path.startsWith(prefix) && path.toLowerCase().endsWith(".md"),
      );
    },
    upsert_note: changed,
    remove_note: changed,
    remove_notes: changed,
    rename_note_path: changed,
    remove_notes_by_prefix: changed,
    rename_folder_paths: changed,
    subscribe_index_progress(callback) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
  };
}
