import type { WatcherPort } from "$lib/features/watcher/ports";
import type { VaultFsEvent } from "$lib/features/watcher/types/watcher";
import {
  WORKSPACE_SOURCE,
  type WebApi,
} from "$lib/shared/adapters/web/web_api";
import type { WebEvent, WebEvents } from "$lib/shared/adapters/web/web_events";
import type { WebFiles } from "$lib/shared/adapters/web/web_files";

type SourcesResponse = {
  version: 1;
  sources: Array<{ id: string; commit?: string }>;
};

const KIND_TO_TYPE = {
  added: "note_added",
  changed: "note_changed_externally",
  removed: "note_removed",
} as const;

// The server streams changes of the user's workspace. Read-only sources
// (main, drafts) move only when the background sync fetches; their commit is
// compared on every sync status change.
export function create_watcher_web_adapter(
  api: WebApi,
  files: WebFiles,
  events: WebEvents,
): WatcherPort {
  const listeners = new Set<(event: VaultFsEvent) => void>();
  let watched: string | null = null;
  let stop_events: (() => void) | null = null;
  let checking_commit = false;

  const emit = (event: VaultFsEvent) => {
    for (const listener of listeners) listener(event);
  };

  function resynced(vault_id: string) {
    files.invalidate_tree(vault_id);
    emit({ type: "vault_resynced", vault_id });
  }

  async function check_source_commit(vault_id: string) {
    if (checking_commit) return;
    checking_commit = true;
    try {
      const [tree, sources] = await Promise.all([
        files.tree(vault_id),
        api.get_json<SourcesResponse>("/api/sources", 1),
      ]);
      const source = sources.sources.find((item) => item.id === vault_id);
      if (watched === vault_id && source?.commit !== tree.commit)
        resynced(vault_id);
    } catch (error) {
      console.error("[watcher_web] source check failed", error);
    } finally {
      checking_commit = false;
    }
  }

  async function on_event(event: WebEvent) {
    const vault_id = watched;
    if (!vault_id) return;
    if (event.type === "snapshot_lost") {
      resynced(vault_id);
      return;
    }
    if (event.type === "sync") {
      if (vault_id !== WORKSPACE_SOURCE) void check_source_commit(vault_id);
      return;
    }
    if (vault_id !== WORKSPACE_SOURCE) return;
    for (const change of await files.classify_workspace_changes(event.changes))
      if (watched === vault_id)
        emit({
          type: KIND_TO_TYPE[change.kind],
          vault_id,
          note_path: change.path,
        });
  }

  return {
    watch_vault(vault_id) {
      watched = vault_id;
      stop_events ??= events.subscribe((event) => void on_event(event));
      return Promise.resolve();
    },
    unwatch_vault() {
      watched = null;
      stop_events?.();
      stop_events = null;
      return Promise.resolve();
    },
    subscribe_fs_events(callback) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
  };
}
