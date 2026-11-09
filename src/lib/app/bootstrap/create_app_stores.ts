import { InfoHubStore } from "$lib/features/infohub";
import { VaultStore } from "$lib/features/vault";
import { NotesStore } from "$lib/features/note";
import { EditorStore } from "$lib/features/editor";
import { UIStore } from "$lib/app/orchestration/ui_store.svelte";
import { OpStore } from "$lib/app/orchestration/op_store.svelte";
import { SearchStore } from "$lib/features/search";
import { TabStore } from "$lib/features/tab";

export type AppStores = {
  infohub: InfoHubStore;
  vault: VaultStore;
  notes: NotesStore;
  editor: EditorStore;
  ui: UIStore;
  op: OpStore;
  search: SearchStore;
  tab: TabStore;
};

export function create_app_stores(): AppStores {
  return {
    infohub: new InfoHubStore(),
    vault: new VaultStore(),
    notes: new NotesStore(),
    editor: new EditorStore(),
    ui: new UIStore(),
    op: new OpStore(),
    search: new SearchStore(),
    tab: new TabStore(),
  };
}
