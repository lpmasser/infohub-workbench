<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import { create_app_context } from "$lib/app/di/create_app_context";
  import { provide_app_context } from "$lib/app/context/app_context.svelte";
  import { AppShell } from "$lib/app";
  import type { Ports } from "$lib/app/di/app_ports";
  import { as_vault_path } from "$lib/shared/types/ids";
  import { WORKSPACE_SOURCE } from "$lib/shared/adapters/web/web_api";

  type Props = {
    ports: Ports;
    sign_out: () => Promise<void>;
  };

  const props: Props = $props();

  // Opens the user's workspace; main and drafts are a switch away.
  const app = untrack(() =>
    create_app_context({
      ports: props.ports,
      now_ms: () => Date.now(),
      default_mount_config: {
        reset_app_state: false,
        bootstrap_default_vault_path: as_vault_path(WORKSPACE_SOURCE),
      },
      sign_out: props.sign_out,
    }),
  );

  provide_app_context(app);

  onDestroy(() => {
    app.destroy();
  });
</script>

<AppShell />
