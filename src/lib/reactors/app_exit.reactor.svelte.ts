import { untrack } from "svelte";
import { publish_update_blocked } from "$lib/app/orchestration/app_exit";

export function create_app_exit_reactor(is_blocked: () => boolean): () => void {
  return $effect.root(() => {
    $effect(() => {
      const blocked = is_blocked();
      untrack(() => {
        void publish_update_blocked(blocked);
      });
    });
  });
}
