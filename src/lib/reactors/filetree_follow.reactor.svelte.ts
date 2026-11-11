import { untrack } from "svelte";
import { ACTION_IDS } from "$lib/app/action_registry/action_ids";
import { is_draft_note_path } from "$lib/features/note";
import type { ReactorContext } from "$lib/reactors";

// Like VS Code's explorer.autoReveal: while the file tree is on screen it
// shows the open document. A hidden tree is left alone and catches up when it
// is shown again (the phone sidebar, or switching back from another view).
export function create_filetree_follow_reactor(
  context: Pick<
    ReactorContext,
    "editor_store" | "ui_store" | "action_registry"
  >,
): () => void {
  return $effect.root(() => {
    const following = $derived(
      context.ui_store.editor_settings.filetree_auto_reveal &&
        context.ui_store.sidebar_open &&
        context.ui_store.sidebar_view === "explorer",
    );
    // Edits replace open_note; only a different document should reveal.
    const open_path = $derived(context.editor_store.open_note?.meta.path);
    $effect(() => {
      const path = open_path;
      if (!following || !path || is_draft_note_path(path)) return;
      untrack(() => {
        void context.action_registry.execute(ACTION_IDS.filetree_reveal_note, {
          note_path: path,
          show_explorer: false,
        });
      });
    });
  });
}
