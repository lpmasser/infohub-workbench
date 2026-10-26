/** @vitest-environment jsdom */
import { it, expect, vi } from "vitest";
import { flushSync } from "svelte";
import { create_workspace_queries_reactor } from "$lib/reactors/workspace_queries.reactor.svelte";
import { SearchStore } from "$lib/features/search";
import { VaultStore } from "$lib/features/vault";
import { UIStore } from "$lib/app";
import { InfoHubService } from "$lib/features/infohub/application/infohub_service";
import { InfoHubStore } from "$lib/features/infohub/state/infohub_store.svelte";
import { infohub_overview } from "../helpers/infohub_fixtures";
import { create_test_vault } from "../helpers/test_fixtures";

// The public Svelte entry resolves to the server build in Vitest; effects use the client runtime.
vi.mock("svelte", async () => {
  const api = await vi.importActual<typeof import("svelte")>("svelte");
  const client = await vi.importActual<{
    untrack: (typeof import("svelte"))["untrack"];
  }>("svelte/internal/client");
  return { ...api, untrack: client.untrack };
});

it("refreshes an open search on index completion without subscribing to the action's own state writes", async () => {
  const search_store = new SearchStore();
  const ui_store = new UIStore();
  ui_store.omnibar = {
    ...ui_store.omnibar,
    open: true,
    query: "外部改动验收词",
  };
  let result = "stale";
  const dispose = create_workspace_queries_reactor({
    search_store,
    ui_store,
    vault_store: new VaultStore(),
    infohub_store: new InfoHubStore(),
    editor_service: { refresh_frontmatter() {} } as never,
    infohub_service: {
      select() {},
      refresh_sync: () => Promise.resolve(),
      refresh_overview: () => Promise.resolve(),
    } as never,
    action_registry: {
      execute(_action: string, query: string) {
        ui_store.omnibar = { ...ui_store.omnibar, is_searching: false };
        result = query;
        return Promise.resolve();
      },
    } as never,
  });
  try {
    flushSync();
    await Promise.resolve();
    await Promise.resolve();
    search_store.set_index_progress({
      vault_id: "v1",
      status: "completed",
      indexed: 1,
      elapsed_ms: 1,
    });
    flushSync();
    await Promise.resolve();
    await Promise.resolve();
    flushSync();
    expect(result).toBe("外部改动验收词");
    expect(ui_store.omnibar.is_searching).toBe(false);
  } finally {
    dispose();
  }
});

it("does no overview IO while idle, refreshes when the overview sidebar becomes visible and file-index completion, and keeps polling sync", async () => {
  vi.useFakeTimers();
  const search_store = new SearchStore();
  const ui_store = new UIStore();
  const vault_store = new VaultStore();
  const store = new InfoHubStore();
  ui_store.set_sidebar_view("explorer");
  vault_store.set_vault(create_test_vault());
  let source = "initial";
  let dirty = "before.md";
  const overview_io: string[] = [];
  const service = new InfoHubService(
    {
      overview: () => {
        overview_io.push(source);
        return Promise.resolve(infohub_overview(source));
      },
      sync_status: () =>
        Promise.resolve({ version: 1, running: true, dirtyFiles: [dirty] }),
    },
    store,
  );
  const refresh_frontmatter = vi.fn();
  const dispose = create_workspace_queries_reactor({
    infohub_store: store,
    editor_service: { refresh_frontmatter } as never,
    search_store,
    ui_store,
    vault_store,
    infohub_service: service,
    action_registry: { execute: () => Promise.resolve() } as never,
  });
  async function settle() {
    flushSync();
    await Promise.resolve();
    await Promise.resolve();
  }
  try {
    await settle();
    dirty = "after.md";
    await vi.advanceTimersByTimeAsync(30_000);
    expect(overview_io).toEqual([]);
    expect(store.overview).toBeNull();
    expect(store.sync?.dirtyFiles).toEqual(["after.md"]);

    ui_store.set_sidebar_view("overview");
    await settle();
    expect(store.overview?.needsAction[0]?.object.title).toBe("initial");
    ui_store.sidebar_open = false;
    await settle();
    source = "reopened sidebar";
    await vi.advanceTimersByTimeAsync(30_000);
    expect(overview_io).toEqual(["initial"]);
    ui_store.sidebar_open = true;
    await settle();
    expect(store.overview?.needsAction[0]?.object.title).toBe(
      "reopened sidebar",
    );
    source = "pending file change";
    await vi.advanceTimersByTimeAsync(30_000);
    expect(overview_io).toEqual(["initial", "reopened sidebar"]);

    // A model JSON edit can complete the Markdown index with zero indexed notes.
    search_store.set_index_progress({
      vault_id: "vault-1",
      status: "completed",
      indexed: 0,
      elapsed_ms: 1,
    });
    await settle();
    expect(store.overview?.needsAction[0]?.object.title).toBe(
      "pending file change",
    );
    flushSync();
    expect(refresh_frontmatter.mock.calls.length).toBeGreaterThan(1);
    refresh_frontmatter.mockClear();
    store.overview_error = "CLI unavailable";
    await settle();
    expect(refresh_frontmatter).toHaveBeenCalledOnce();
    ui_store.set_sidebar_view("explorer");
    await settle();
    source = "reopened";
    ui_store.set_sidebar_view("overview");
    await settle();
    expect(store.overview?.needsAction[0]?.object.title).toBe("reopened");

    ui_store.set_sidebar_view("explorer");
    await settle();
    source = "hidden page file change";
    search_store.set_index_progress({
      vault_id: "vault-1",
      status: "completed",
      indexed: 1,
      elapsed_ms: 1,
    });
    await settle();
    expect(store.overview?.needsAction[0]?.object.title).toBe(
      "hidden page file change",
    );
  } finally {
    dispose();
    vi.useRealTimers();
  }
});
