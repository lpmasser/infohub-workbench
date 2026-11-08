import {
  create_infohub_tauri_adapter,
  create_infohub_web_adapter,
} from "$lib/features/infohub";
import {
  create_assets_tauri_adapter,
  create_assets_web_adapter,
  create_notes_tauri_adapter,
  create_notes_web_adapter,
} from "$lib/features/note";
import {
  create_session_tauri_adapter,
  create_session_web_adapter,
} from "$lib/features/session";
import {
  create_vault_tauri_adapter,
  create_vault_settings_tauri_adapter,
  create_vault_settings_web_adapter,
  create_vault_web_adapter,
} from "$lib/features/vault";
import {
  create_settings_tauri_adapter,
  create_settings_web_adapter,
} from "$lib/features/settings";
import {
  create_search_tauri_adapter,
  create_search_web_adapter,
  create_workspace_index_tauri_adapter,
  create_workspace_index_web_adapter,
} from "$lib/features/search";
import { create_codemirror_editor_port } from "$lib/features/editor";
import {
  create_clipboard_tauri_adapter,
  create_clipboard_web_adapter,
} from "$lib/features/clipboard";
import {
  create_shell_tauri_adapter,
  create_shell_web_adapter,
} from "$lib/features/shell";
import {
  create_git_tauri_adapter,
  create_git_web_adapter,
} from "$lib/features/git";
import {
  create_watcher_tauri_adapter,
  create_watcher_web_adapter,
} from "$lib/features/watcher";
import {
  create_web_session_adapter,
  type WebSessionPort,
} from "$lib/features/web_session";
import { WebApi, WORKSPACE_SOURCE } from "$lib/shared/adapters/web/web_api";
import { WebEvents } from "$lib/shared/adapters/web/web_events";
import { WebFiles } from "$lib/shared/adapters/web/web_files";
import {
  create_document_tauri_adapter,
  document_asset_url,
} from "$lib/features/document";
import type { Ports } from "$lib/app/di/app_ports";
import type { DocumentWindowPorts } from "$lib/app/di/create_document_window_context";

export function create_prod_ports(): Ports {
  const assets = create_assets_tauri_adapter();
  const vault = create_vault_tauri_adapter();
  const notes = create_notes_tauri_adapter();
  const index = create_workspace_index_tauri_adapter();
  const search = create_search_tauri_adapter();
  const settings = create_settings_tauri_adapter();
  const vault_settings = create_vault_settings_tauri_adapter();
  const session = create_session_tauri_adapter();
  const clipboard = create_clipboard_tauri_adapter();
  const shell = create_shell_tauri_adapter();
  const git = create_git_tauri_adapter();
  const watcher = create_watcher_tauri_adapter();

  return {
    infohub: create_infohub_tauri_adapter(),
    vault,
    notes,
    index,
    search,
    settings,
    vault_settings,
    session,
    assets,
    editor: create_codemirror_editor_port({
      resolve_asset_url_for_vault: (vault_id, asset_path) =>
        assets.resolve_asset_url(vault_id, asset_path),
      copy_text: (text) => clipboard.write_text(text),
    }),
    clipboard,
    shell,
    git,
    watcher,
  };
}

// The browser build: one connection (HTTP client, file versions, event
// stream) shared by every adapter, plus the sign-in the page needs first.
export function create_web_ports(): { ports: Ports; session: WebSessionPort } {
  const api = new WebApi();
  const files = new WebFiles(api);
  const events = new WebEvents(api);
  const assets = create_assets_web_adapter();
  const clipboard = create_clipboard_web_adapter();

  return {
    session: create_web_session_adapter(api, events),
    ports: {
      infohub: create_infohub_web_adapter(api, events),
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
      git: create_git_web_adapter(),
      watcher: create_watcher_web_adapter(api, files, events),
    },
  };
}

export function create_document_window_ports(
  window_label: string,
): DocumentWindowPorts {
  const clipboard = create_clipboard_tauri_adapter();
  return {
    settings: create_settings_tauri_adapter(),
    vault_settings: create_vault_settings_tauri_adapter(),
    shell: create_shell_tauri_adapter(),
    document: create_document_tauri_adapter(),
    editor: create_codemirror_editor_port({
      // Document buffers have no vault, so this never runs.
      resolve_asset_url_for_vault: () => "",
      copy_text: (text) => clipboard.write_text(text),
      resolve_document_asset_url: (relative_path) =>
        document_asset_url(window_label, relative_path),
    }),
  };
}
