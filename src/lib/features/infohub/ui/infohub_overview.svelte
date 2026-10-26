<script lang="ts">
  import { cn } from "$lib/shared/utils/component_utils";
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import * as Tooltip from "$lib/components/ui/tooltip";
  import { use_app_context } from "$lib/app/context/app_context.svelte";
  import type { HubObject } from "../types/infohub";

  let { on_open }: { on_open: (path: string) => void } = $props();
  const { stores } = use_app_context();
  const hub = stores.infohub;
  let selection = $state<{ vault: string | undefined; project: string } | null>(
    null,
  );
  const project = $derived(
    selection?.vault === stores.vault.vault?.id
      ? hub.overview?.projects.find((item) => item.id === selection?.project)
      : undefined,
  );
</script>

{#snippet document_row(item: HubObject, reason: string, category?: string)}
  <Tooltip.Root>
    <Tooltip.Trigger
      class={cn(
        "flex w-full min-w-0 items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs text-sidebar-foreground hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
        stores.editor.open_note?.meta.path === item.path && "bg-sidebar-accent",
      )}
      aria-current={stores.editor.open_note?.meta.path === item.path
        ? "page"
        : undefined}
      aria-label={category
        ? `${category}：${item.title} — ${reason}`
        : `${item.title} — ${reason}`}
      onclick={() => on_open(item.path)}
    >
      <span class="min-w-0 basis-2/5 truncate">{item.title}</span>
      <span class="min-w-0 flex-1 truncate text-[10px] text-muted-foreground"
        >{reason}</span
      >
    </Tooltip.Trigger>
    <Tooltip.Content
      side="right"
      align="start"
      sideOffset={8}
      class="max-w-sm whitespace-pre-wrap break-words"
    >
      <p class="font-medium">{item.title}</p>
      {#if category}<p>{category}</p>{/if}
      <p>{String(item.frontmatter.attention || reason)}</p>
      <p class="mt-1">更新：{String(item.frontmatter.updated ?? "未标注")}</p>
    </Tooltip.Content>
  </Tooltip.Root>
{/snippet}

<Tooltip.Provider delayDuration={300}>
  <section
    class="min-h-0 flex-1 overflow-y-auto px-2 py-2 text-xs"
    aria-label="InfoHub 工作汇总"
  >
    {#if hub.overview_error}<p
        class="mb-2 break-words text-destructive"
        role="alert"
      >
        汇总读取失败：{hub.overview_error}
      </p>{/if}
    {#if hub.sync_error}<p
        class="mb-2 break-words text-destructive"
        role="alert"
      >
        同步状态读取失败：{hub.sync_error}
      </p>{/if}
    {#if hub.sync && !hub.sync.running}<p class="mb-2 text-muted-foreground">
        后台同步未运行
      </p>{/if}
    {#each Object.values(hub.sync?.pending ?? {}) as reason}<p
        class="mb-2 break-words text-muted-foreground"
        role="status"
      >
        同步：{reason}
      </p>{/each}
    {#if !hub.overview && hub.loading}<p class="px-2 text-muted-foreground">
        正在读取 InfoHub…
      </p>{/if}
    {#if hub.overview}
      {#if project}
        <button
          class="mb-2 flex items-center gap-1 rounded-sm px-2 py-1.5 text-muted-foreground hover:bg-sidebar-accent"
          onclick={() => (selection = null)}
        >
          <ArrowLeft class="size-3" />返回汇总
        </button>
        <h2 class="flex items-center gap-2 px-2 py-1.5 font-medium">
          <span class="min-w-0 flex-1 truncate">{project.title}</span>
          <span class="shrink-0 text-[10px] text-muted-foreground"
            >进行中 {project.ongoingCount} 件</span
          >
        </h2>
        {#each project.work as item (item.id)}
          {@render document_row(
            item,
            `${String(item.frontmatter.requirement ?? "")}·${String(item.frontmatter.progress ?? "")}`,
          )}
        {/each}
        {#if project.work.length === 0}<p
            class="px-2 py-2 text-muted-foreground"
          >
            没有未完结的工作。
          </p>{/if}
      {:else}
        <h2 class="flex items-center gap-2 px-2 py-1.5 font-medium">
          要我管的 <span class="ml-auto tabular-nums text-muted-foreground"
            >{hub.overview.needsAction.length}</span
          >
        </h2>
        <div class="max-h-[45vh] overflow-y-auto">
          {#each hub.overview.needsAction as item (item.object.id)}
            {@render document_row(item.object, item.reason, item.category)}
          {/each}
        </div>
        {#if hub.overview.needsAction.length === 0}<p
            class="px-2 py-2 text-muted-foreground"
          >
            暂时没有需要你处理的事。
          </p>{/if}
        <h2 class="mt-3 border-t px-2 pt-3 pb-1.5 font-medium">
          各项目在做什么
        </h2>
        {#each hub.overview.projects as item (item.id)}
          <button
            class="flex w-full min-w-0 items-center gap-1 rounded-sm px-2 py-2 text-left hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            title={item.title}
            onclick={() =>
              (selection = { vault: stores.vault.vault?.id, project: item.id })}
          >
            <span class="w-2/5 shrink-0 truncate">{item.title}</span>
            <span class="min-w-0 flex-1 text-[10px] text-muted-foreground"
              >进行中 {item.ongoingCount} 件 · 最近 {hub.overview
                .deliveryWindowDays} 天交付 {item.deliveredCount} 件</span
            >
            <ChevronRight class="size-3 shrink-0 text-muted-foreground" />
          </button>
        {/each}
        {#if hub.overview.projects.length === 0}<p
            class="px-2 py-2 text-muted-foreground"
          >
            没有项目。
          </p>{/if}
      {/if}
      {#if hub.overview.issues.length}
        <details class="mt-3 border-t px-2 pt-2 text-muted-foreground">
          <summary class="cursor-pointer"
            >文档校验：{hub.overview.issues.length} 个问题</summary
          >
          {#each hub.overview.issues as issue}<p class="mt-1 break-words">
              {issue.path}：{issue.message}
            </p>{/each}
        </details>
      {/if}
    {/if}
  </section>
</Tooltip.Provider>
