import { create_infohub_web_adapter } from "$lib/features/infohub";
import { create_annotations_web_adapter } from "$lib/features/annotation";
import { create_location_web_adapter } from "$lib/features/deep_link";
import {
  create_assets_web_adapter,
  create_notes_web_adapter,
} from "$lib/features/note";
import { create_session_web_adapter } from "$lib/features/session";
import {
  create_vault_settings_web_adapter,
  create_vault_web_adapter,
} from "$lib/features/vault";
import { create_settings_web_adapter } from "$lib/features/settings";
import {
  create_search_web_adapter,
  create_workspace_index_web_adapter,
} from "$lib/features/search";
import { create_codemirror_editor_port } from "$lib/features/editor";
import { create_clipboard_web_adapter } from "$lib/features/clipboard";
import { create_shell_web_adapter } from "$lib/features/shell";
import { create_watcher_web_adapter } from "$lib/features/watcher";
import {
  create_web_session_adapter,
  type WebSessionPort,
} from "$lib/features/web_session";
import { WebApi, WORKSPACE_SOURCE } from "$lib/shared/adapters/web/web_api";
import { WebEvents } from "$lib/shared/adapters/web/web_events";
import { WebFiles } from "$lib/shared/adapters/web/web_files";
import type { Ports } from "$lib/app/di/app_ports";

// One connection to the InfoHub Web API (HTTP client, file trees, event
// stream) shared by every adapter, plus the sign-in the page needs first.
export function create_prod_ports(): { ports: Ports; session: WebSessionPort } {
  const api = new WebApi();
  const files = new WebFiles(api);
  const events = new WebEvents(api);
  const assets = create_assets_web_adapter(files);
  const clipboard = create_clipboard_web_adapter();

  return {
    session: create_web_session_adapter(api, events),
    ports: {
      infohub: create_infohub_web_adapter(api, events),
      annotations: create_annotations_web_adapter(api),
      location: create_location_web_adapter(),
      vault: create_vault_web_adapter(api),
      notes: create_notes_web_adapter(files),
      index: create_workspace_index_web_adapter(files),
      search: create_search_web_adapter(files),
      settings: create_settings_web_adapter(),
      vault_settings: create_vault_settings_web_adapter(),
      session: create_session_web_adapter(),
      assets,
      editor: create_codemirror_editor_port({
        resolve_asset_url_for_vault: (vault_id, asset_path) =>
          assets.resolve_asset_url(vault_id, asset_path),
        copy_text: (text) => clipboard.write_text(text),
        is_read_only_vault: (vault_id) => vault_id !== WORKSPACE_SOURCE,
      }),
      clipboard,
      shell: create_shell_web_adapter(),
      watcher: create_watcher_web_adapter(api, files, events),
    },
  };
}
