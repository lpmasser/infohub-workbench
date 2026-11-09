import type { SettingsPort } from "$lib/features/settings/ports";
import {
  read_browser_value,
  write_browser_value,
} from "$lib/shared/adapters/web/browser_storage";

export function create_settings_web_adapter(): SettingsPort {
  return {
    get_setting<T>(key: string): Promise<T | null> {
      return Promise.resolve(read_browser_value<T>(`setting:${key}`));
    },
    set_setting(key: string, value: unknown): Promise<void> {
      write_browser_value(`setting:${key}`, value);
      return Promise.resolve();
    },
  };
}
