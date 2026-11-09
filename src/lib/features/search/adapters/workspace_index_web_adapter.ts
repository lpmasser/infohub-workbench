import type { WorkspaceIndexPort } from "$lib/features/search/ports";
import type { WebFiles } from "$lib/shared/adapters/web/web_files";
import type { IndexProgressEvent } from "$lib/shared/types/search";

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

  return {
    sync_index,
    rebuild_index(vault_id) {
      files.invalidate_tree(vault_id);
      return sync_index(vault_id);
    },
    subscribe_index_progress(callback) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
  };
}
