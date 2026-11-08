<script lang="ts">
  import { onMount } from "svelte";
  import AppRoot from "$lib/app/bootstrap/ui/app_root.svelte";
  import { create_web_ports } from "$lib/app/create_prod_ports";
  import { LoginForm } from "$lib/features/web_session";
  import { as_vault_path } from "$lib/shared/types/ids";
  import { WORKSPACE_SOURCE } from "$lib/shared/adapters/web/web_api";

  const { ports, session } = create_web_ports();

  let status = $state<"checking" | "signed_out" | "signed_in" | "error">(
    "checking",
  );
  // An expired session covers the app instead of unmounting it, so open
  // tabs and unsaved text survive signing in again.
  let expired = $state(false);
  let error = $state<string | null>(null);

  function check_session() {
    status = "checking";
    session
      .current()
      .then((info) => {
        status = info ? "signed_in" : "signed_out";
      })
      .catch((failure: unknown) => {
        error = failure instanceof Error ? failure.message : String(failure);
        status = "error";
      });
  }

  onMount(() => {
    const stop = session.on_signed_out(() => {
      if (status === "signed_in") expired = true;
      else status = "signed_out";
    });
    check_session();
    return stop;
  });

  async function sign_in(username: string, password: string) {
    await session.login(username, password);
    expired = false;
    status = "signed_in";
  }

  async function sign_out() {
    await session.logout();
    // A fresh page drops every in-memory snapshot of the old session.
    window.location.reload();
  }
</script>

{#if status === "signed_in"}
  <AppRoot
    {ports}
    default_vault_path={as_vault_path(WORKSPACE_SOURCE)}
    {sign_out}
  />
{/if}

{#if expired}
  <!-- A modal <dialog> makes the rest of the page inert, including any app
       dialog that would otherwise keep focus to itself. -->
  <dialog
    class="WebRoot__expired"
    {@attach (dialog) => dialog.showModal()}
    oncancel={(event) => event.preventDefault()}
  >
    <LoginForm
      title="InfoHub"
      message="登录已过期。重新登录后继续，未保存的内容仍在页面上。"
      on_submit={sign_in}
    />
  </dialog>
{:else if status === "signed_out"}
  <div class="WebRoot__gate">
    <LoginForm title="InfoHub" on_submit={sign_in} />
  </div>
{:else if status === "checking"}
  <div class="WebRoot__gate"><p class="WebRoot__note">正在连接…</p></div>
{:else if status === "error"}
  <div class="WebRoot__gate">
    <div class="WebRoot__note" role="alert">
      <p>无法连接 InfoHub：{error}</p>
      <button type="button" class="WebRoot__retry" onclick={check_session}
        >重试</button
      >
    </div>
  </div>
{/if}

<style>
  .WebRoot__gate {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100dvh;
    padding: var(--space-4);
    background-color: var(--background);
  }

  .WebRoot__expired {
    /* An open app dialog disables pointer events on body. */
    pointer-events: auto;
    margin: auto;
    padding: 0;
    border: none;
    background: transparent;
  }

  .WebRoot__expired::backdrop {
    background-color: color-mix(in oklab, var(--background) 85%, transparent);
  }

  .WebRoot__note {
    color: var(--muted-foreground);
    font-size: 0.875rem;
  }

  .WebRoot__retry {
    margin-top: var(--space-2);
    text-decoration: underline;
  }
</style>
