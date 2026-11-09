import { InfoHubStore } from "$lib/features/infohub";
import { AnnotationStore } from "$lib/features/annotation";
import { DeepLinkStore } from "$lib/features/deep_link";
import { VaultStore } from "$lib/features/vault";
import { NotesStore } from "$lib/features/note";
import { EditorStore } from "$lib/features/editor";
import { UIStore } from "$lib/app/orchestration/ui_store.svelte";
import { OpStore } from "$lib/app/orchestration/op_store.svelte";
import { SearchStore } from "$lib/features/search";
import { TabStore } from "$lib/features/tab";

export type AppStores = {
  infohub: InfoHubStore;
  annotation: AnnotationStore;
  deep_link: DeepLinkStore;
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
    annotation: new AnnotationStore(),
    deep_link: new DeepLinkStore(),
    vault: new VaultStore(),
    notes: new NotesStore(),
    editor: new EditorStore(),
    ui: new UIStore(),
    op: new OpStore(),
    search: new SearchStore(),
    tab: new TabStore(),
  };
}
