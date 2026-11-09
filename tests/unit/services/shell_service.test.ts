import { describe, expect, it } from "vitest";
import { ShellService } from "$lib/features/shell/application/shell_service";
import { VaultStore } from "$lib/features/vault/state/vault_store.svelte";
import { create_test_shell_adapter } from "../../adapters/test_shell_adapter";
import { create_test_vault } from "../helpers/test_fixtures";

function create_harness({ with_vault = true } = {}) {
  const port = create_test_shell_adapter();
  const vault_store = new VaultStore();
  if (with_vault) vault_store.set_vault(create_test_vault());
  return { port, service: new ShellService(port, vault_store) };
}

describe("ShellService.open_file", () => {
  it("opens the vault item", async () => {
    const { port, service } = create_harness();

    expect(await service.open_file("docs/a.md")).toBe(true);
    expect(port._calls.open_file).toEqual(["docs/a.md"]);
  });

  it("does nothing without an open vault", async () => {
    const { port, service } = create_harness({ with_vault: false });

    expect(await service.open_file("docs/a.md")).toBe(false);
    expect(port._calls.open_file).toEqual([]);
  });

  it("reports failure when the port throws", async () => {
    const { port, service } = create_harness();
    port.open_file = () => Promise.reject(new Error("gone"));

    expect(await service.open_file("docs/a.md")).toBe(false);
  });
});
