import { untrack } from "svelte";
import { ACTION_IDS } from "$lib/app/action_registry/action_ids";
import type { ReactorContext } from "$lib/reactors";

export function create_workspace_queries_reactor(
  context: Pick<
    ReactorContext,
    | "infohub_service"
    | "infohub_store"
    | "editor_service"
    | "vault_store"
    | "search_store"
    | "ui_store"
    | "action_registry"
  >,
): () => void {
  return $effect.root(() => {
    $effect(() => {
      void context.infohub_store.overview?.references;
      void context.infohub_store.overview_error;
      untrack(() => {
        context.editor_service.refresh_frontmatter();
      });
    });
    $effect(() => {
      context.infohub_service.select(context.vault_store.vault?.id ?? null);
      void context.infohub_service.refresh_sync();
      const timer = setInterval(() => {
        void context.infohub_service.refresh_sync();
      }, 5000);
      return () => {
        clearInterval(timer);
      };
    });
    $effect(() => {
      const vault_id = context.vault_store.vault?.id;
      const open =
        context.ui_store.sidebar_open &&
        context.ui_store.sidebar_view === "overview";
      untrack(() => {
        if (vault_id && open) void context.infohub_service.refresh_overview();
      });
    });
    $effect(() => {
      const status = context.search_store.index_progress.status;
      untrack(() => {
        if (status === "completed")
          void context.infohub_service.refresh_overview();
        if (status === "completed" && context.ui_store.omnibar.open) {
          void context.action_registry.execute(
            ACTION_IDS.omnibar_set_query,
            context.ui_store.omnibar.query,
          );
        }
      });
    });
  });
}
