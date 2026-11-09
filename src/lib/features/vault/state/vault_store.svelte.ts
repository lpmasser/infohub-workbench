import type { Vault } from "$lib/shared/types/vault";
import type { VaultId } from "$lib/shared/types/ids";

// The open source and the sources the server offers, in the server's order.
export class VaultStore {
  vault = $state<Vault | null>(null);
  recent_vaults = $state<Vault[]>([]);
  generation = $state(0);

  clear() {
    this.vault = null;
    this.generation += 1;
  }

  set_vault(vault: Vault) {
    this.vault = vault;
    this.generation += 1;
  }

  set_recent_vaults(vaults: Vault[]) {
    this.recent_vaults = vaults;
  }

  set_vault_availability(vault_id: VaultId, is_available: boolean) {
    this.recent_vaults = this.recent_vaults.map((vault) =>
      vault.id === vault_id ? { ...vault, is_available } : vault,
    );

    if (this.vault?.id === vault_id) {
      this.vault = { ...this.vault, is_available };
      this.generation += 1;
    }
  }

  bump_generation() {
    this.generation += 1;
  }

  reset() {
    this.vault = null;
    this.recent_vaults = [];
    this.generation += 1;
  }
}
