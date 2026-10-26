import { it, expect } from "vitest";
import { InfoHubService } from "$lib/features/infohub/application/infohub_service";
import { InfoHubStore } from "$lib/features/infohub/state/infohub_store.svelte";
import type { InfoHubPort } from "$lib/features/infohub/ports";
import type { Overview, SyncStatus } from "$lib/features/infohub/types/infohub";
import { as_vault_id } from "$lib/shared/types/ids";
import { infohub_overview } from "../helpers/infohub_fixtures";

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

it("keeps sync markers independent of a slow overview and re-reads changes arriving during the query", async () => {
  const first = deferred<Overview>();
  let source = "before";
  const store = new InfoHubStore();
  const port: InfoHubPort = {
    overview: () =>
      source === "before"
        ? first.promise
        : Promise.resolve(infohub_overview(source)),
    sync_status: () =>
      Promise.resolve({
        version: 1,
        running: true,
        dirtyFiles: ["editing.md"],
      }),
  };
  const service = new InfoHubService(port, store);
  service.select(as_vault_id("a"));
  const active = service.refresh_overview();
  await service.refresh_sync();
  expect(store.sync?.dirtyFiles).toEqual(["editing.md"]);
  expect(store.loading).toBe(true);
  source = "latest file change";
  await service.refresh_overview();
  first.resolve(infohub_overview("before"));
  await active;
  expect(store.overview?.needsAction[0]?.object.title).toBe(
    "latest file change",
  );
  expect(store.loading).toBe(false);
});

it("discards both old-vault responses after a switch without overwriting the new vault", async () => {
  const old_overview = deferred<Overview>();
  const old_sync = deferred<SyncStatus>();
  const store = new InfoHubStore();
  const service = new InfoHubService(
    {
      overview: (id) =>
        id === "a"
          ? old_overview.promise
          : Promise.resolve(infohub_overview("vault b")),
      sync_status: (id) =>
        id === "a"
          ? old_sync.promise
          : Promise.resolve({
              version: 1,
              running: true,
              dirtyFiles: ["b.md"],
            }),
    },
    store,
  );
  service.select(as_vault_id("a"));
  const pending = [service.refresh_overview(), service.refresh_sync()];
  service.select(as_vault_id("b"));
  await Promise.all([service.refresh_overview(), service.refresh_sync()]);
  old_overview.resolve(infohub_overview("stale a"));
  old_sync.resolve({ version: 1, running: false, dirtyFiles: ["a.md"] });
  await Promise.all(pending);
  expect(store.overview?.needsAction[0]?.object.title).toBe("vault b");
  expect(store.sync?.dirtyFiles).toEqual(["b.md"]);
  expect(store.loading).toBe(false);
});

it("reports a failed overview while sync continues and retries on the next overview event", async () => {
  let failed = true;
  const store = new InfoHubStore();
  const service = new InfoHubService(
    {
      overview: () =>
        failed
          ? Promise.reject(new Error("CLI unavailable"))
          : Promise.resolve(infohub_overview("recovered")),
      sync_status: () =>
        Promise.resolve({
          version: 1,
          running: true,
          dirtyFiles: ["latest.md"],
        }),
    },
    store,
  );
  service.select(as_vault_id("a"));
  await service.refresh_overview();
  expect(store.overview_error).toContain("CLI unavailable");
  expect(store.loading).toBe(false);
  await service.refresh_sync();
  expect(store.sync?.dirtyFiles).toEqual(["latest.md"]);
  failed = false;
  await service.refresh_overview();
  expect(store.overview?.needsAction[0]?.object.title).toBe("recovered");
  expect(store.overview_error).toBeNull();
});
