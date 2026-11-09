import { ACTION_IDS } from "$lib/app/action_registry/action_ids";
import type { ActionRegistrationInput } from "$lib/app/action_registry/action_registration_input";
import { toast } from "svelte-sonner";

import type { SidebarView } from "$lib/app/orchestration/ui_store.svelte";

export function register_ui_actions(input: ActionRegistrationInput) {
  const { registry, stores, services } = input;

  function parse_sidebar_view(input_view: unknown): SidebarView {
    const value = String(input_view).trim();
    if (value === "overview") return "overview";
    if (value === "starred") {
      return "starred";
    }
    if (value === "dashboard") {
      return "dashboard";
    }
    return "explorer";
  }

  function set_vault_dashboard_open(open: boolean) {
    stores.ui.vault_dashboard = { open };
  }

  function execute_open_external_url(url: unknown) {
    if (typeof url !== "string") {
      return;
    }
    void services.shell.open_url(url);
  }

  registry.register({
    id: ACTION_IDS.shell_open_url,
    label: "Open External URL",
    execute: execute_open_external_url,
  });

  registry.register({
    id: ACTION_IDS.shell_open_file,
    label: "Open in New Tab",
    execute: async (path: unknown) => {
      const ok = await services.shell.open_file(String(path));
      if (!ok) toast.error("Could not open the file");
    },
  });

  // Clicking a link to a non-note file in the editor, like a pdf.
  registry.register({
    id: ACTION_IDS.shell_open_linked_file,
    label: "Open Linked File",
    execute: async (path: unknown) => {
      const ok = await services.shell.open_file(String(path));
      if (!ok) toast.error("Could not open the linked file");
    },
  });

  registry.register({
    id: ACTION_IDS.ui_toggle_sidebar,
    label: "Toggle Sidebar",
    shortcut: "CmdOrCtrl+B",
    execute: () => {
      stores.ui.toggle_sidebar();
    },
  });

  registry.register({
    id: ACTION_IDS.ui_select_folder,
    label: "Select Folder",
    execute: (path: unknown) => {
      stores.ui.set_selected_folder_path(String(path));
    },
  });

  registry.register({
    id: ACTION_IDS.ui_set_sidebar_view,
    label: "Set Sidebar View",
    execute: (view: unknown) => {
      const next_view = parse_sidebar_view(view);
      stores.ui.set_sidebar_view(next_view);
      if (next_view === "dashboard") {
        void services.vault.refresh_dashboard_stats();
      }
    },
  });

  registry.register({
    id: ACTION_IDS.ui_open_vault_dashboard,
    label: "Open Vault Dashboard",
    shortcut: "CmdOrCtrl+Shift+D",
    execute: () => {
      set_vault_dashboard_open(true);
      void services.vault.refresh_dashboard_stats();
    },
  });

  registry.register({
    id: ACTION_IDS.ui_close_vault_dashboard,
    label: "Close Vault Dashboard",
    execute: () => {
      set_vault_dashboard_open(false);
    },
  });
}
