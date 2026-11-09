import { describe, expect, it } from "vitest";
import { VaultStore } from "$lib/features/vault/state/vault_store.svelte";
import { create_test_vault } from "../helpers/test_fixtures";
import { as_vault_id } from "$lib/shared/types/ids";

describe("VaultStore", () => {
  it("sets and clears vault while updating generation", () => {
    const store = new VaultStore();
    const initial_generation = store.generation;

    const vault = create_test_vault();
    store.set_vault(vault);

    expect(store.vault).toEqual(vault);
    expect(store.generation).toBe(initial_generation + 1);

    store.clear();

    expect(store.vault).toBeNull();
    expect(store.generation).toBe(initial_generation + 2);
  });

  it("sets recent vaults", () => {
    const store = new VaultStore();
    const vault = create_test_vault();

    store.set_recent_vaults([vault]);

    expect(store.recent_vaults).toEqual([vault]);
  });

  it("bumps generation without changing vault selection", () => {
    const store = new VaultStore();
    const initial_generation = store.generation;

    store.bump_generation();

    expect(store.generation).toBe(initial_generation + 1);
    expect(store.vault).toBeNull();
  });

  it("updates vault availability in recent and active vault", () => {
    const store = new VaultStore();
    const vault = create_test_vault({ id: as_vault_id("vault-a") });
    store.set_recent_vaults([vault]);
    store.set_vault(vault);

    store.set_vault_availability(vault.id, false);

    expect(store.recent_vaults[0]?.is_available).toBe(false);
    expect(store.vault?.is_available).toBe(false);
  });
});
