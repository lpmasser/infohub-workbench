<script lang="ts">
  import { use_app_context } from "$lib/app/context/app_context.svelte";
  let { path }: { path: string } = $props();
  const { stores } = use_app_context();
  const local = $derived(
    stores.infohub.sync?.dirtyFiles?.includes(path) ||
      stores.infohub.sync?.blockedFiles?.includes(path),
  );
  const draft = $derived(
    stores.infohub.sync?.server?.drafts.some((item) =>
      item.changedPaths?.includes(path),
    ),
  );
</script>

{#if local}<span
    class="SyncMarker local"
    title="本地正在改，暂时收不到远端更新"
    aria-label="本地正在改，暂时收不到远端更新">●</span
  >{/if}
{#if draft}<span class="SyncMarker draft" title="有草稿" aria-label="有草稿"
    >◆</span
  >{/if}

<style>
  .SyncMarker {
    flex: none;
    font-size: 10px;
    margin-inline: 3px;
  }
  .local {
    color: var(--warning-text-on-bg);
  }
  .draft {
    color: var(--interactive);
  }
</style>
