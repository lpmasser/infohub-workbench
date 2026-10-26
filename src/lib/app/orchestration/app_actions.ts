import { ACTION_IDS } from "$lib/app/action_registry/action_ids";
import type { ActionRegistrationInput } from "$lib/app/action_registry/action_registration_input";
import type { OpenNoteState } from "$lib/shared/types/editor";
import { to_editor_buffer_view_state } from "$lib/shared/types/editor";
import { DEFAULT_EDITOR_SETTINGS } from "$lib/shared/types/editor_settings";
import { DEFAULT_HOTKEYS } from "$lib/features/hotkey";
import { apply_opened_vault_session } from "$lib/features/vault";
import { create_logger } from "$lib/shared/utils/logger";

const log = create_logger("app_actions");
const is_performance_logging_enabled =
  import.meta.env.DEV && import.meta.env.MODE !== "test";

type VaultInitializeResult = Awaited<
  ReturnType<ActionRegistrationInput["services"]["vault"]["initialize"]>
>;

type AppBootstrapData = {
  vault_initialize_result: VaultInitializeResult;
  recent_command_ids: Awaited<
    ReturnType<
      ActionRegistrationInput["services"]["settings"]["load_recent_command_ids"]
    >
  >;
  hotkey_overrides: Awaited<
    ReturnType<
      ActionRegistrationInput["services"]["hotkey"]["load_hotkey_overrides"]
    >
  >;
  theme_result: Awaited<
    ReturnType<ActionRegistrationInput["services"]["theme"]["load_themes"]>
  >;
};

function set_startup_loading(input: ActionRegistrationInput) {
  input.stores.ui.startup = {
    status: "loading",
    error: null,
  };
}

function set_startup_error(input: ActionRegistrationInput, error: string) {
  input.stores.ui.startup = {
    status: "error",
    error,
  };
}

function set_startup_idle(input: ActionRegistrationInput) {
  input.stores.ui.startup = {
    status: "idle",
    error: null,
  };
}

async function load_bootstrap_data(
  input: ActionRegistrationInput,
): Promise<AppBootstrapData> {
  const { services, default_mount_config } = input;
  const [
    vault_initialize_result,
    recent_command_ids,
    hotkey_overrides,
    theme_result,
  ] = await Promise.all([
    services.vault.initialize(default_mount_config),
    services.settings.load_recent_command_ids(),
    services.hotkey.load_hotkey_overrides(),
    services.theme.load_themes(),
  ]);

  return {
    vault_initialize_result,
    recent_command_ids,
    hotkey_overrides,
    theme_result,
  };
}

function apply_loaded_preferences(
  input: ActionRegistrationInput,
  data: AppBootstrapData,
) {
  const { stores, services } = input;
  stores.ui.set_user_themes(data.theme_result.user_themes);
  stores.ui.set_active_theme_id(data.theme_result.active_theme_id);
  stores.ui.set_recent_command_ids(data.recent_command_ids);

  stores.ui.hotkey_overrides = data.hotkey_overrides;
  const hotkeys_config = services.hotkey.merge_config(
    DEFAULT_HOTKEYS,
    data.hotkey_overrides,
  );
  stores.ui.set_hotkeys_config(hotkeys_config);
}

function reset_ui_state_for_mount(input: ActionRegistrationInput) {
  input.stores.ui.reset_for_new_vault();
  input.stores.ui.set_editor_settings({ ...DEFAULT_EDITOR_SETTINGS });
}

async function mount_ready_vault_state(
  input: ActionRegistrationInput,
  result: Extract<VaultInitializeResult, { status: "ready" }>,
) {
  if (!result.has_vault) {
    return;
  }

  await apply_opened_vault_session(
    input,
    result.editor_settings ?? { ...DEFAULT_EDITOR_SETTINGS },
  );

  if (input.stores.ui.editor_settings.show_vault_dashboard_on_open) {
    await input.registry.execute(ACTION_IDS.ui_open_vault_dashboard);
  }
}

async function execute_app_mounted(input: ActionRegistrationInput) {
  const started_at = is_performance_logging_enabled ? performance.now() : null;
  set_startup_loading(input);

  const bootstrap_data = await load_bootstrap_data(input);
  apply_loaded_preferences(input, bootstrap_data);

  if (bootstrap_data.vault_initialize_result.status === "error") {
    set_startup_error(input, bootstrap_data.vault_initialize_result.error);
    if (started_at !== null) {
      log.debug("App bootstrap failed", {
        duration_ms: performance.now() - started_at,
      });
    }
    return;
  }

  if (input.default_mount_config.reset_app_state) {
    reset_ui_state_for_mount(input);
  }

  await mount_ready_vault_state(input, bootstrap_data.vault_initialize_result);
  set_startup_idle(input);
  if (started_at !== null) {
    log.debug("App bootstrap ready", {
      duration_ms: performance.now() - started_at,
      // Includes frontend loading since navigation, but not native process launch.
      navigation_ready_ms: performance.now(),
    });
  }
}

export function register_app_actions(input: ActionRegistrationInput) {
  const { registry, services, stores } = input;

  registry.register({
    id: ACTION_IDS.app_mounted,
    label: "App Mounted",
    execute: async () => execute_app_mounted(input),
  });

  registry.register({
    id: ACTION_IDS.app_editor_mount,
    label: "Editor Mount",
    execute: async (root: unknown, note: unknown) => {
      await services.editor.mount({
        root: root as HTMLDivElement,
        note: note as OpenNoteState,
      });
      const active_tab = stores.tab.active_tab;
      if (!active_tab) return;
      if (active_tab.note_path !== (note as OpenNoteState).meta.path) return;
      const snapshot = stores.tab.get_snapshot(active_tab.id);
      services.editor.set_scroll_top(snapshot?.scroll_top ?? 0);
      services.editor.restore_view_state(to_editor_buffer_view_state(snapshot));
    },
  });

  registry.register({
    id: ACTION_IDS.app_editor_unmount,
    label: "Editor Unmount",
    execute: () => {
      services.editor.unmount();
    },
  });

  registry.register({
    id: ACTION_IDS.editor_toggle_source_mode,
    label: "Toggle Source Mode",
    execute: () => {
      services.editor.toggle_source_mode();
    },
  });
}
