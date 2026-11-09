<script lang="ts">
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import Check from "@lucide/svelte/icons/check";
  import type { Vault } from "$lib/shared/types/vault";
  import type { VaultId } from "$lib/shared/types/ids";

  // The sources: the user's workspace (writable), main and the
  // other copies' unpushed drafts (read-only).
  interface Props {
    open: boolean;
    on_open_change: (open: boolean) => void;
    sources: Vault[];
    current_source_id: VaultId | null;
    is_loading?: boolean;
    error?: string | null;
    on_select_source: (source_id: VaultId) => void;
  }

  let {
    open,
    on_open_change,
    sources,
    current_source_id,
    is_loading = false,
    error = null,
    on_select_source,
  }: Props = $props();
</script>

<Dialog.Root {open} onOpenChange={on_open_change}>
  <Dialog.Content class="SourceDialog font-sans">
    <Dialog.Header>
      <Dialog.Title>切换来源</Dialog.Title>
      <Dialog.Description>
        只有我的工作区可以编辑；main 和各副本的草稿只读。
      </Dialog.Description>
    </Dialog.Header>
    {#if error}<p class="SourceDialog__error" role="alert">{error}</p>{/if}
    <ul class="SourceDialog__list">
      {#each sources as source (source.id)}
        <li>
          <button
            type="button"
            class="SourceDialog__item"
            class:SourceDialog__item--active={source.id === current_source_id}
            disabled={is_loading || source.id === current_source_id}
            onclick={() => on_select_source(source.id)}
          >
            <span class="SourceDialog__name">
              {source.name}
              {#if source.read_only}<span class="SourceDialog__badge">只读</span
                >{/if}
            </span>
            {#if source.description}<span class="SourceDialog__description"
                >{source.description}</span
              >{/if}
            {#if source.id === current_source_id}<Check
                class="SourceDialog__check"
              />{/if}
          </button>
        </li>
      {/each}
    </ul>
  </Dialog.Content>
</Dialog.Root>

<style>
  :global([data-slot="dialog-content"].SourceDialog) {
    max-height: calc(100dvh - 2rem);
    overflow-y: auto;
  }

  .SourceDialog__list {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .SourceDialog__item {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    width: 100%;
    padding: var(--space-2) var(--space-8) var(--space-2) var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-md, 0.375rem);
    text-align: start;
  }

  .SourceDialog__item:not(:disabled):hover {
    background-color: var(--accent);
  }

  .SourceDialog__item--active {
    border-color: var(--interactive);
  }

  .SourceDialog__name {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-weight: 500;
    overflow-wrap: anywhere;
  }

  .SourceDialog__badge {
    padding-inline: var(--space-1);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm, 0.25rem);
    font-size: var(--text-xs);
    font-weight: 400;
    color: var(--muted-foreground);
  }

  .SourceDialog__description {
    font-size: var(--text-xs);
    color: var(--muted-foreground);
    overflow-wrap: anywhere;
  }

  .SourceDialog__error {
    font-size: var(--text-sm, 0.875rem);
    color: var(--destructive);
  }

  :global(.SourceDialog__check) {
    position: absolute;
    top: var(--space-2);
    inset-inline-end: var(--space-2);
    width: 1rem;
    height: 1rem;
    color: var(--interactive);
  }
</style>
