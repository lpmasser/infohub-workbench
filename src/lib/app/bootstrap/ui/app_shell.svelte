<script lang="ts">
  import { onMount } from "svelte";
  import AppShellDialogs from "$lib/app/bootstrap/ui/app_shell_dialogs.svelte";
  import WorkspaceLayout from "$lib/app/bootstrap/ui/workspace_layout.svelte";
  import { use_keyboard_shortcuts } from "$lib/hooks/use_keyboard_shortcuts.svelte";
  import { use_external_links } from "$lib/hooks/use_external_links.svelte";
  import { use_app_context } from "$lib/app/context/app_context.svelte";
  import { ACTION_IDS } from "$lib/app";

  const { stores, action_registry } = use_app_context();

  const external_links = use_external_links({
    open_url: (url) => action_registry.execute(ACTION_IDS.shell_open_url, url),
  });

  const has_vault = $derived(stores.vault.vault !== null);
  const omnibar_open = $derived(stores.ui.omnibar.open);

  const any_blocking_dialog_open = $derived(
    stores.ui.change_vault.open ||
      stores.ui.change_vault.confirm_discard_open ||
      stores.ui.delete_note_dialog.open ||
      stores.ui.rename_note_dialog.open ||
      stores.ui.save_note_dialog.open ||
      stores.ui.settings_dialog.open ||
      stores.ui.image_paste_dialog.open ||
      stores.ui.tab_close_confirm.open ||
      stores.ui.help_dialog.open ||
      stores.ui.annotation_dialog.open,
  );

  // Every bits-ui Dialog.Content is role="dialog" (alertdialog for alerts) while
  // open. Reading the DOM at event time also covers component-local dialogs
  // such as Note Details. The omnibar is excluded so we can tell when something
  // else is in front of it.
  const OPEN_DIALOG_SELECTOR =
    '[data-state="open"]:is([role="dialog"], [role="alertdialog"]):not(.Omnibar)';

  const other_dialog_open = () =>
    any_blocking_dialog_open ||
    document.querySelector(OPEN_DIALOG_SELECTOR) !== null;

  const vault_selection_loading = $derived(
    stores.ui.startup.status === "loading" || stores.ui.change_vault.is_loading,
  );

  const keyboard = use_keyboard_shortcuts({
    hotkeys_config: () => stores.ui.hotkeys_config,
    is_enabled: () => has_vault,
    is_blocked: () => omnibar_open || other_dialog_open(),
    is_omnibar_topmost: () => omnibar_open && !other_dialog_open(),
    is_vault_switcher_open: () => stores.ui.change_vault.open,
    is_hotkey_recorder_open: () => stores.ui.hotkey_recorder.open,
    has_tabs: () => stores.tab.has_tabs,
    action_registry,
    on_close_vault_switcher: () => {
      void action_registry.execute(ACTION_IDS.vault_close_change);
    },
    on_switch_to_tab: (index) => {
      void action_registry.execute(ACTION_IDS.tab_activate_by_index, index);
    },
  });

  onMount(() => {
    void action_registry.execute(ACTION_IDS.app_mounted);
  });
</script>

{#if !has_vault}
  <div class="mx-auto max-w-[65ch] p-8 text-sm text-muted-foreground">
    {#if vault_selection_loading}
      <p>正在打开工作区…</p>
    {:else}
      <p role="alert">
        无法打开工作区：{stores.ui.startup.error ??
          stores.ui.change_vault.error ??
          "未知错误"}
      </p>
      <button
        type="button"
        class="mt-2 underline"
        onclick={() => void action_registry.execute(ACTION_IDS.app_mounted)}
        >重试</button
      >
    {/if}
  </div>
{:else}
  <main>
    <WorkspaceLayout />
  </main>
{/if}

<AppShellDialogs />

<svelte:window
  onclick={external_links.handle_click}
  onkeydowncapture={keyboard.handle_keydown_capture}
  onkeydown={keyboard.handle_keydown}
/>
