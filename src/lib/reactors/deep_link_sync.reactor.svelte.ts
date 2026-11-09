import { untrack } from "svelte";
import { ACTION_IDS } from "$lib/app/action_registry/action_ids";
import { is_draft_note_path } from "$lib/features/note";
import type { ReactorContext } from "$lib/reactors";

// The address bar names the open document, so it can be copied; Back and
// Forward open the document their address names.
export function create_deep_link_sync_reactor(
  context: Pick<
    ReactorContext,
    | "deep_link_service"
    | "deep_link_store"
    | "editor_store"
    | "vault_store"
    | "infohub_store"
    | "action_registry"
  >,
): () => void {
  return $effect.root(() => {
    $effect(() => {
      const path = context.editor_store.open_note?.meta.path;
      const source = context.vault_store.vault?.id;
      const references = context.infohub_store.overview?.references;
      const ready = context.deep_link_store.ready;
      untrack(() => {
        if (!ready) return;
        if (!path || !source || is_draft_note_path(path)) return;
        const object_id =
          Object.entries(references ?? {}).find(
            ([, reference]) => reference.path === path,
          )?.[0] ?? null;
        context.deep_link_service.show_document(path, source, object_id);
      });
    });
    $effect(() =>
      context.deep_link_service.on_history_move(
        (link) =>
          void context.action_registry.execute(ACTION_IDS.deep_link_open, link),
      ),
    );
  });
}
