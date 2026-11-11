export type SettingsCategory =
  | "theme"
  | "layout"
  | "files"
  | "misc"
  | "hotkeys";

export type HeadingFilenameDelimiter = "spaces" | "hyphens";

export type EditorSettings = {
  attachment_folder: string;
  store_attachments_with_note: boolean;
  show_hidden_files: boolean;
  filetree_auto_reveal: boolean;
  autosave_enabled: boolean;
  autosave_delay_ms: number;
  show_vault_dashboard_on_open: boolean;
  max_open_tabs: number;
  editor_max_width_ch: number;
  editor_zoom: number;
  heading_filename_delimiter: HeadingFilenameDelimiter;
};

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  // InfoHub keeps attachments beside their document, in "附件" inside the
  // note's folder; nothing goes loose at the repository root.
  attachment_folder: "附件",
  store_attachments_with_note: false,
  show_hidden_files: false,
  filetree_auto_reveal: true,
  autosave_enabled: true,
  autosave_delay_ms: 2000,
  show_vault_dashboard_on_open: true,
  max_open_tabs: 5,
  editor_max_width_ch: 85,
  editor_zoom: 1,
  heading_filename_delimiter: "spaces",
};

export const SETTINGS_KEY = "editor" as const;

export const GLOBAL_ONLY_SETTING_KEYS: readonly (keyof EditorSettings)[] = [
  "show_vault_dashboard_on_open",
  "filetree_auto_reveal",
  "autosave_enabled",
  "autosave_delay_ms",
  "editor_max_width_ch",
  "editor_zoom",
  "heading_filename_delimiter",
] as const;

const GLOBAL_ONLY_SET = new Set<string>(GLOBAL_ONLY_SETTING_KEYS);

export function omit_global_only_keys(
  record: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (!GLOBAL_ONLY_SET.has(key)) {
      result[key] = value;
    }
  }
  return result;
}

export async function apply_global_only_overrides(
  base: EditorSettings,
  get_setting: (key: string) => Promise<unknown>,
): Promise<EditorSettings> {
  const result = { ...base };
  for (const key of GLOBAL_ONLY_SETTING_KEYS) {
    const global_value = await get_setting(key);
    if (typeof global_value === typeof base[key]) {
      (result as Record<string, unknown>)[key] = global_value;
    }
  }
  return result;
}
