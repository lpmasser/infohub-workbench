<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import { create_prod_ports } from "$lib/app/create_prod_ports";
  import { create_app_context } from "$lib/app/di/create_app_context";
  import { provide_app_context } from "$lib/app/context/app_context.svelte";
  import { AppShell } from "$lib/app";
  import type { Ports } from "$lib/app/di/app_ports";
  import type { VaultPath } from "$lib/shared/types/ids";

  type Props = {
    // The browser build passes its HTTP ports and opens its workspace.
    ports?: Ports;
    default_vault_path?: VaultPath | null;
    sign_out?: () => Promise<void>;
  };

  const props: Props = $props();

  const app = untrack(() =>
    create_app_context({
      ports: props.ports ?? create_prod_ports(),
      now_ms: () => Date.now(),
      default_mount_config: {
        reset_app_state: false,
        bootstrap_default_vault_path: props.default_vault_path ?? null,
      },
      ...(props.sign_out ? { sign_out: props.sign_out } : {}),
    }),
  );

  provide_app_context(app);

  onDestroy(() => {
    app.destroy();
  });
</script>

<AppShell />
