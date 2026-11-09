import { describe, expect, it, vi } from "vitest";
import { VaultService } from "$lib/features/vault/application/vault_service";
import { VaultStore } from "$lib/features/vault/state/vault_store.svelte";
import { NotesStore } from "$lib/features/note/state/note_store.svelte";
import { EditorStore } from "$lib/features/editor/state/editor_store.svelte";
import { OpStore } from "$lib/app/orchestration/op_store.svelte";
import { SearchStore } from "$lib/features/search/state/search_store.svelte";
import {
  as_note_path,
  as_vault_id,
  as_vault_path,
} from "$lib/shared/types/ids";
import type { Vault } from "$lib/shared/types/vault";

function create_deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (error?: unknown) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("VaultService", () => {
  it("ignores stale vault-open completions when newer request wins", async () => {
    const vault_a: Vault = {
      id: as_vault_id("vault-a"),
      name: "Vault A",
      path: as_vault_path("/vault/a"),
      created_at: 1,
    };
    const vault_b: Vault = {
      id: as_vault_id("vault-b"),
      name: "Vault B",
      path: as_vault_path("/vault/b"),
      created_at: 1,
    };

    const open_a = create_deferred<Vault>();
    const open_b = create_deferred<Vault>();

    const vault_port = {
      open_vault: vi.fn(),
      open_vault_by_id: vi.fn((vault_id: string) => {
        if (vault_id === vault_a.id) return open_a.promise;
        return open_b.promise;
      }),
      list_vaults: vi.fn().mockResolvedValue([vault_a, vault_b]),
    };

    const notes_port = {
      list_folder_contents: vi.fn((vault_id: string) =>
        Promise.resolve({
          notes: [
            {
              id: as_note_path(`${vault_id}/alpha.md`),
              path: as_note_path(`${vault_id}/alpha.md`),
              name: "alpha",
              title: "alpha",
              version: null,
              size_bytes: 0,
            },
          ],
          subfolders: [],
          total_count: 1,
          has_more: false,
        }),
      ),
      get_folder_stats: vi.fn().mockResolvedValue({
        note_count: 1,
        folder_count: 0,
      }),
    };

    const index_port = {
      cancel_index: vi.fn().mockResolvedValue(undefined),
      sync_index: vi.fn().mockResolvedValue(undefined),
      rebuild_index: vi.fn().mockResolvedValue(undefined),
      upsert_note: vi.fn(),
      remove_note: vi.fn(),
      remove_notes: vi.fn(),
      remove_notes_by_prefix: vi.fn(),
      rename_note_path: vi.fn(),
      rename_folder_paths: vi.fn(),
      subscribe_index_progress: vi.fn().mockReturnValue(() => {}),
    };

    const settings_port = {
      get_setting: vi.fn().mockResolvedValue(null),
      set_setting: vi.fn(),
    };

    const vault_settings_port = {
      get_vault_setting: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(["vault-b/alpha.md"])
        .mockResolvedValue(null),
      set_vault_setting: vi.fn().mockResolvedValue(undefined),
      delete_vault_setting: vi.fn(),
    };

    const vault_store = new VaultStore();
    const notes_store = new NotesStore();
    const editor_store = new EditorStore();
    const op_store = new OpStore();
    const search_store = new SearchStore();

    const service = new VaultService(
      vault_port as never,
      notes_port as never,
      index_port as never,
      settings_port as never,
      vault_settings_port as never,
      vault_store,
      notes_store,
      editor_store,
      op_store,
      search_store,
      () => 1,
    );

    const first = service.change_vault_by_id(vault_a.id);
    const second = service.change_vault_by_id(vault_b.id);

    open_b.resolve(vault_b);
    const second_result = await second;
    expect(second_result.status).toBe("opened");
    expect(vault_store.vault?.id).toBe(vault_b.id);
    expect(notes_store.starred_paths).toEqual(["vault-b/alpha.md"]);

    open_a.resolve(vault_a);
    const first_result = await first;
    expect(first_result).toEqual({ status: "stale" });
    expect(vault_store.vault?.id).toBe(vault_b.id);
  });

  it("syncs index after opening vault", async () => {
    const vault: Vault = {
      id: as_vault_id("vault-a"),
      name: "Vault A",
      path: as_vault_path("/vault/a"),
      created_at: 1,
    };

    const vault_port = {
      open_vault: vi.fn(),
      open_vault_by_id: vi.fn().mockResolvedValue(vault),
      list_vaults: vi.fn().mockResolvedValue([vault]),
    };

    const notes_port = {
      list_folder_contents: vi.fn().mockResolvedValue({
        notes: [],
        subfolders: [],
        total_count: 0,
        has_more: false,
      }),
      get_folder_stats: vi.fn().mockResolvedValue({
        note_count: 0,
        folder_count: 0,
      }),
    };

    const index_port = {
      cancel_index: vi.fn().mockResolvedValue(undefined),
      sync_index: vi.fn().mockResolvedValue(undefined),
      rebuild_index: vi.fn().mockResolvedValue(undefined),
      upsert_note: vi.fn(),
      remove_note: vi.fn(),
      remove_notes: vi.fn(),
      remove_notes_by_prefix: vi.fn(),
      rename_note_path: vi.fn(),
      rename_folder_paths: vi.fn(),
      subscribe_index_progress: vi.fn().mockReturnValue(() => {}),
    };

    const settings_port = {
      get_setting: vi.fn().mockResolvedValue(null),
      set_setting: vi.fn(),
    };
    const vault_settings_port = {
      get_vault_setting: vi.fn().mockResolvedValue(null),
      set_vault_setting: vi.fn().mockResolvedValue(undefined),
      delete_vault_setting: vi.fn(),
    };
    const service = new VaultService(
      vault_port as never,
      notes_port as never,
      index_port as never,
      settings_port as never,
      vault_settings_port as never,

      new VaultStore(),
      new NotesStore(),
      new EditorStore(),
      new OpStore(),
      new SearchStore(),
      () => 1,
    );

    const result = await service.change_vault_by_id(vault.id);
    expect(result.status).toBe("opened");
    expect(index_port.sync_index).toHaveBeenCalledTimes(1);
  });

  it("returns failure when selecting an unavailable vault by id", async () => {
    const unavailable_error = "vault unavailable at path: /vault/missing";
    const vault_a: Vault = {
      id: as_vault_id("vault-a"),
      name: "Vault A",
      path: as_vault_path("/vault/a"),
      created_at: 1,
    };

    const vault_port = {
      open_vault: vi.fn(),
      open_vault_by_id: vi.fn().mockRejectedValue(new Error(unavailable_error)),
      list_vaults: vi.fn().mockResolvedValue([vault_a]),
    };

    const service = new VaultService(
      vault_port as never,
      {
        list_folder_contents: vi.fn().mockResolvedValue({
          notes: [],
          subfolders: [],
          total_count: 0,
          has_more: false,
        }),
        get_folder_stats: vi.fn().mockResolvedValue({
          note_count: 0,
          folder_count: 0,
        }),
      } as never,
      {
        cancel_index: vi.fn(),
        sync_index: vi.fn(),
        rebuild_index: vi.fn(),
        upsert_note: vi.fn(),
        remove_note: vi.fn(),
        remove_notes: vi.fn(),
        remove_notes_by_prefix: vi.fn(),
        rename_note_path: vi.fn(),
        rename_folder_paths: vi.fn(),
        subscribe_index_progress: vi.fn().mockReturnValue(() => {}),
      } as never,
      {
        get_setting: vi.fn().mockResolvedValue(null),
        set_setting: vi.fn(),
      } as never,
      {
        get_vault_setting: vi.fn().mockResolvedValue(null),
        set_vault_setting: vi.fn().mockResolvedValue(undefined),
        delete_vault_setting: vi.fn(),
      } as never,

      new VaultStore(),
      new NotesStore(),
      new EditorStore(),
      new OpStore(),
      new SearchStore(),
      () => 1,
    );

    const result = await service.change_vault_by_id(vault_a.id);
    expect(result).toEqual({ status: "failed", error: unavailable_error });
  });

  it("saves starred paths to vault settings", async () => {
    const vault_id = as_vault_id("vault-a");

    const service = new VaultService(
      {
        open_vault: vi.fn(),
        open_vault_by_id: vi.fn(),
        list_vaults: vi.fn(),
      } as never,
      { list_folder_contents: vi.fn(), get_folder_stats: vi.fn() } as never,
      {
        cancel_index: vi.fn(),
        sync_index: vi.fn().mockResolvedValue(undefined),
        rebuild_index: vi.fn(),
        upsert_note: vi.fn(),
        remove_note: vi.fn(),
        remove_notes: vi.fn(),
        remove_notes_by_prefix: vi.fn(),
        rename_note_path: vi.fn(),
        rename_folder_paths: vi.fn(),
        subscribe_index_progress: vi.fn().mockReturnValue(() => {}),
      } as never,
      { get_setting: vi.fn(), set_setting: vi.fn() } as never,
      {
        get_vault_setting: vi.fn(),
        set_vault_setting: vi.fn().mockResolvedValue(undefined),
        delete_vault_setting: vi.fn(),
      } as never,

      new VaultStore(),
      new NotesStore(),
      new EditorStore(),
      new OpStore(),
      new SearchStore(),
      () => 1,
    );

    await service.save_starred_paths(vault_id, ["docs", "docs/a.md"]);

    const mock_port = (
      service as unknown as {
        vault_settings_port: { set_vault_setting: ReturnType<typeof vi.fn> };
      }
    ).vault_settings_port;
    expect(mock_port.set_vault_setting).toHaveBeenCalledWith(
      vault_id,
      "starred_paths",
      ["docs", "docs/a.md"],
    );
  });

  it("skips rebuild while indexing is active", async () => {
    const vault: Vault = {
      id: as_vault_id("vault-a"),
      name: "Vault A",
      path: as_vault_path("/vault/a"),
      created_at: 1,
    };

    const vault_store = new VaultStore();
    vault_store.set_vault(vault);

    const search_store = new SearchStore();
    search_store.set_index_progress({
      status: "started",
      vault_id: vault.id,
      total: 100,
    });

    const index_port = {
      cancel_index: vi.fn().mockResolvedValue(undefined),
      sync_index: vi.fn().mockResolvedValue(undefined),
      rebuild_index: vi.fn().mockResolvedValue(undefined),
      upsert_note: vi.fn(),
      remove_note: vi.fn(),
      remove_notes: vi.fn(),
      remove_notes_by_prefix: vi.fn(),
      rename_note_path: vi.fn(),
      rename_folder_paths: vi.fn(),
      subscribe_index_progress: vi.fn().mockReturnValue(() => {}),
    };

    const service = new VaultService(
      {
        open_vault: vi.fn(),
        open_vault_by_id: vi.fn(),
        list_vaults: vi.fn(),
      } as never,
      { list_folder_contents: vi.fn(), get_folder_stats: vi.fn() } as never,
      index_port as never,
      { get_setting: vi.fn(), set_setting: vi.fn() } as never,
      {
        get_vault_setting: vi.fn(),
        set_vault_setting: vi.fn(),
        delete_vault_setting: vi.fn(),
      } as never,

      vault_store,
      new NotesStore(),
      new EditorStore(),
      new OpStore(),
      search_store,
      () => 1,
    );

    const result = await service.rebuild_index();
    expect(result).toEqual({ status: "skipped" });
    expect(index_port.rebuild_index).not.toHaveBeenCalled();
  });

  it("sync_index skips while indexing is active", async () => {
    const vault: Vault = {
      id: as_vault_id("vault-a"),
      name: "Vault A",
      path: as_vault_path("/vault/a"),
      created_at: 1,
    };

    const vault_store = new VaultStore();
    vault_store.set_vault(vault);

    const search_store = new SearchStore();
    search_store.set_index_progress({
      status: "started",
      vault_id: vault.id,
      total: 100,
    });

    const index_port = {
      cancel_index: vi.fn().mockResolvedValue(undefined),
      sync_index: vi.fn().mockResolvedValue(undefined),
      rebuild_index: vi.fn().mockResolvedValue(undefined),
      upsert_note: vi.fn(),
      remove_note: vi.fn(),
      remove_notes: vi.fn(),
      remove_notes_by_prefix: vi.fn(),
      rename_note_path: vi.fn(),
      rename_folder_paths: vi.fn(),
      subscribe_index_progress: vi.fn().mockReturnValue(() => {}),
    };

    const service = new VaultService(
      {
        open_vault: vi.fn(),
        open_vault_by_id: vi.fn(),
        list_vaults: vi.fn(),
      } as never,
      { list_folder_contents: vi.fn(), get_folder_stats: vi.fn() } as never,
      index_port as never,
      { get_setting: vi.fn(), set_setting: vi.fn() } as never,
      {
        get_vault_setting: vi.fn(),
        set_vault_setting: vi.fn(),
        delete_vault_setting: vi.fn(),
      } as never,

      vault_store,
      new NotesStore(),
      new EditorStore(),
      new OpStore(),
      search_store,
      () => 1,
    );

    const result = await service.sync_index();
    expect(result).toEqual({ status: "skipped" });
    expect(index_port.sync_index).not.toHaveBeenCalled();
  });

  it("refreshes dashboard stats on demand", async () => {
    const vault: Vault = {
      id: as_vault_id("vault-a"),
      name: "Vault A",
      path: as_vault_path("/vault/a"),
      created_at: 1,
    };

    const notes_store = new NotesStore();
    const vault_store = new VaultStore();
    vault_store.set_vault(vault);

    const notes_port = {
      list_folder_contents: vi.fn(),
      get_folder_stats: vi.fn().mockResolvedValue({
        note_count: 12345,
        folder_count: 678,
      }),
    };

    const service = new VaultService(
      {
        open_vault: vi.fn(),
        open_vault_by_id: vi.fn(),
        list_vaults: vi.fn(),
      } as never,
      notes_port as never,
      {
        cancel_index: vi.fn(),
        sync_index: vi.fn(),
        rebuild_index: vi.fn(),
        upsert_note: vi.fn(),
        remove_note: vi.fn(),
        remove_notes: vi.fn(),
        remove_notes_by_prefix: vi.fn(),
        rename_note_path: vi.fn(),
        rename_folder_paths: vi.fn(),
        subscribe_index_progress: vi.fn().mockReturnValue(() => {}),
      } as never,
      { get_setting: vi.fn(), set_setting: vi.fn() } as never,
      {
        get_vault_setting: vi.fn(),
        set_vault_setting: vi.fn(),
        delete_vault_setting: vi.fn(),
      } as never,
      vault_store,
      notes_store,
      new EditorStore(),
      new OpStore(),
      new SearchStore(),
      () => 1,
    );

    const result = await service.refresh_dashboard_stats();

    expect(result).toEqual({
      status: "ready",
      stats: { note_count: 12345, folder_count: 678 },
    });
    expect(notes_port.get_folder_stats).toHaveBeenCalledWith(vault.id, "");
    expect(notes_store.dashboard_stats).toEqual({
      status: "ready",
      value: { note_count: 12345, folder_count: 678 },
      error: null,
    });
  });

  it("sets dashboard stats error when stats load fails", async () => {
    const vault: Vault = {
      id: as_vault_id("vault-a"),
      name: "Vault A",
      path: as_vault_path("/vault/a"),
      created_at: 1,
    };

    const notes_store = new NotesStore();
    const vault_store = new VaultStore();
    vault_store.set_vault(vault);

    const notes_port = {
      list_folder_contents: vi.fn(),
      get_folder_stats: vi.fn().mockRejectedValue(new Error("scan failed")),
    };

    const service = new VaultService(
      {
        open_vault: vi.fn(),
        open_vault_by_id: vi.fn(),
        list_vaults: vi.fn(),
      } as never,
      notes_port as never,
      {
        cancel_index: vi.fn(),
        sync_index: vi.fn(),
        rebuild_index: vi.fn(),
        upsert_note: vi.fn(),
        remove_note: vi.fn(),
        remove_notes: vi.fn(),
        remove_notes_by_prefix: vi.fn(),
        rename_note_path: vi.fn(),
        rename_folder_paths: vi.fn(),
        subscribe_index_progress: vi.fn().mockReturnValue(() => {}),
      } as never,
      { get_setting: vi.fn(), set_setting: vi.fn() } as never,
      {
        get_vault_setting: vi.fn(),
        set_vault_setting: vi.fn(),
        delete_vault_setting: vi.fn(),
      } as never,
      vault_store,
      notes_store,
      new EditorStore(),
      new OpStore(),
      new SearchStore(),
      () => 1,
    );

    const result = await service.refresh_dashboard_stats();

    expect(result).toEqual({ status: "failed", error: "scan failed" });
    expect(notes_store.dashboard_stats).toEqual({
      status: "error",
      value: null,
      error: "scan failed",
    });
  });
});
