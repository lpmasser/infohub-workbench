import { tauri_invoke } from "$lib/shared/adapters/tauri_invoke";
import type { InfoHubPort } from "../ports";
import { parse_overview, parse_sync_status } from "../domain/parse_infohub";

const SYNC_POLL_MS = 5000;

export function create_infohub_tauri_adapter(): InfoHubPort {
  return {
    async overview(vault_id) {
      return parse_overview(
        await tauri_invoke<unknown>("infohub_overview", { vaultId: vault_id }),
      );
    },
    // The desktop asks the local CLI; there is no change notification for
    // the sync state file, so it polls.
    watch_sync_status(vault_id, handlers) {
      let stopped = false;
      let busy = false;
      const poll = async () => {
        if (busy) return;
        busy = true;
        try {
          const status = parse_sync_status(
            await tauri_invoke<unknown>("infohub_sync_status", {
              vaultId: vault_id,
            }),
          );
          if (!stopped) handlers.on_status(status);
        } catch (error) {
          if (!stopped) handlers.on_error(error);
        } finally {
          busy = false;
        }
      };
      void poll();
      const timer = setInterval(() => void poll(), SYNC_POLL_MS);
      return () => {
        stopped = true;
        clearInterval(timer);
      };
    },
  };
}
