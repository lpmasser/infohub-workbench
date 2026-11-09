import { toast } from "svelte-sonner";
import { ACTION_IDS } from "$lib/app/action_registry/action_ids";
import type { ActionRegistrationInput } from "$lib/app/action_registry/action_registration_input";
import type { DeepLink } from "$lib/features/deep_link/domain/deep_link";
import { as_note_path, as_vault_id } from "$lib/shared/types/ids";

const MISSING_TOAST_MS = 12_000;

export function register_deep_link_actions(input: ActionRegistrationInput) {
  const { registry, stores, services } = input;

  async function switch_source(source: string): Promise<boolean> {
    if (stores.vault.vault?.id === source) return true;
    if (!stores.vault.recent_vaults.some((vault) => vault.id === source))
      await services.vault.refresh_vault_list();
    if (!stores.vault.recent_vaults.some((vault) => vault.id === source)) {
      toast.error(`来源 ${source} 不存在（草稿可能已合入或清理）`, {
        duration: MISSING_TOAST_MS,
      });
      return false;
    }
    await registry.execute(ACTION_IDS.vault_select, as_vault_id(source));
    return stores.vault.vault?.id === source;
  }

  // Opens what an address names.
  registry.register({
    id: ACTION_IDS.deep_link_open,
    label: "Open Link",
    execute: async (payload: unknown) => {
      const link = payload as DeepLink;
      if (!(await switch_source(link.source))) return;
      if (link.kind === "home") return;
      const path = await services.deep_link.target_path(link);
      const meta = path
        ? await services.note.get_note_meta(as_note_path(path))
        : null;
      if (!path || !meta) {
        const name = link.kind === "object" ? link.id : link.path;
        toast.error(`${name} 还没同步到服务器或已删除`, {
          description: "Agent 推送之后，同步会在几分钟内带到这里。",
          duration: MISSING_TOAST_MS,
        });
        return;
      }
      services.deep_link.mark_shown(path);
      await registry.execute(ACTION_IDS.note_open, path);
      if (link.fragment && stores.editor.open_note?.meta.path === path)
        services.editor.reveal_heading(as_note_path(path), link.fragment);
    },
  });
}
