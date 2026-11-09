<script lang="ts">
  import { use_app_context } from "$lib/app/context/app_context.svelte";
  import { ACTION_IDS } from "$lib/app";
  import type { AnnotationEntry } from "$lib/features/annotation/ports";

  const { stores, action_registry } = use_app_context();
  const annotations = stores.annotation;
  const current = $derived(
    annotations.source === stores.vault.vault?.id ? annotations.list : null,
  );

  function open(entry: AnnotationEntry) {
    void action_registry.execute(ACTION_IDS.annotation_open_entry, {
      path: entry.path,
      line: entry.line,
    });
  }
</script>

<section
  class="min-h-0 flex-1 overflow-y-auto px-2 py-2 text-xs"
  aria-label="批注列表"
>
  {#if annotations.error}
    <p class="mb-2 break-words text-destructive" role="alert">
      批注读取失败：{annotations.error}
    </p>
  {/if}
  {#if !current}
    <p class="text-muted-foreground">
      {annotations.loading ? "正在读取批注…" : ""}
    </p>
  {:else if current.entries.length === 0}
    <p class="text-muted-foreground">这个来源里还没有批注。</p>
  {:else}
    <ul class="flex flex-col gap-1">
      {#each current.entries as entry (`${entry.path}:${String(entry.line)}`)}
        <li>
          <button
            type="button"
            class="w-full rounded-sm px-2 py-1.5 text-left hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            class:bg-sidebar-accent={stores.editor.open_note?.meta.path ===
              entry.path}
            onclick={() => open(entry)}
            title={`${entry.path} 第 ${String(entry.line)} 行`}
          >
            <span class="block truncate font-medium text-sidebar-foreground"
              >{entry.title ?? entry.path}</span
            >
            <span class="block text-[10px] text-muted-foreground"
              >{entry.author} · {entry.date}</span
            >
            <span class="block line-clamp-2 break-words text-sidebar-foreground"
              >{entry.text}</span
            >
          </button>
        </li>
      {/each}
    </ul>
  {/if}
  {#if current?.issues.length}
    <p class="mt-3 text-muted-foreground">
      {current.issues.length} 处批注格式有误：
    </p>
    <ul class="mt-1 flex flex-col gap-1 text-muted-foreground">
      {#each current.issues as issue, index (index)}
        <li class="break-words">{issue.message}（{issue.path}）</li>
      {/each}
    </ul>
  {/if}
</section>
