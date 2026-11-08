import type { VaultSettingsPort } from "$lib/features/vault/ports";
import type { VaultId } from "$lib/shared/types/ids";
import {
  read_browser_value,
  write_browser_value,
} from "$lib/shared/adapters/web/browser_storage";

export function create_vault_settings_web_adapter(): VaultSettingsPort {
  return {
    get_vault_setting<T>(vault_id: VaultId, key: string): Promise<T | null> {
      return Promise.resolve(
        read_browser_value<T>(`source:${vault_id}:${key}`),
      );
    },
    set_vault_setting(
      vault_id: VaultId,
      key: string,
      value: unknown,
    ): Promise<void> {
      write_browser_value(`source:${vault_id}:${key}`, value);
      return Promise.resolve();
    },
  };
}
