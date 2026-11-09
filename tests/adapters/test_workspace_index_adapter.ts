import type { WorkspaceIndexPort } from "$lib/features/search";

export function create_test_workspace_index_adapter(): WorkspaceIndexPort {
  return {
    sync_index: () => Promise.resolve(),
    rebuild_index: () => Promise.resolve(),
    subscribe_index_progress: () => () => {},
  };
}
