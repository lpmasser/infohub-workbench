<script lang="ts">
  import { current_document_window_label } from "$lib/app/window_kind";
  import { is_web_build } from "$lib/app/runtime_target";
  import AppRoot from "$lib/app/bootstrap/ui/app_root.svelte";
  import DocumentWindowRoot from "$lib/app/bootstrap/ui/document_window_root.svelte";
  import WebRoot from "$lib/app/bootstrap/ui/web_root.svelte";

  const document_window_label = is_web_build
    ? null
    : current_document_window_label();
</script>

{#if is_web_build}
  <WebRoot />
{:else if document_window_label}
  <DocumentWindowRoot window_label={document_window_label} />
{:else}
  <AppRoot />
{/if}
