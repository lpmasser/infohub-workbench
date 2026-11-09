import type { SessionPort } from "$lib/features/session/ports";
import type { VaultId } from "$lib/shared/types/ids";
import {
  read_browser_value,
  write_browser_value,
} from "$lib/shared/adapters/web/browser_storage";

// The tab layout, including unsaved buffers, stays in this browser so a
// reload or an expired sign-in does not lose typed text.
export function create_session_web_adapter(): SessionPort {
  return {
    load_latest_session<T>(vault_id: VaultId): Promise<T | null> {
      return Promise.resolve(read_browser_value<T>(`session:${vault_id}`));
    },
    save_latest_session(vault_id: VaultId, session: unknown): Promise<void> {
      write_browser_value(`session:${vault_id}`, session);
      return Promise.resolve();
    },
  };
}
