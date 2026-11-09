import { ACTION_IDS } from "$lib/app/action_registry/action_ids";
import type { ActionRegistrationInput } from "$lib/app/action_registry/action_registration_input";
import { is_draft_note_path } from "$lib/features/note";
import { as_note_path } from "$lib/shared/types/ids";

export function register_annotation_actions(input: ActionRegistrationInput) {
  const { registry, stores, services } = input;
  const can_annotate = () => {
    const note = stores.editor.open_note;
    return (
      Boolean(note) &&
      !stores.vault.vault?.read_only &&
      !is_draft_note_path(note?.meta.path ?? "")
    );
  };
  const close = () => {
    stores.ui.annotation_dialog = { open: false, text: "", error: null };
  };

  registry.register({
    id: ACTION_IDS.annotation_request,
    label: "批注",
    when: can_annotate,
    execute: () => {
      stores.ui.annotation_dialog = { open: true, text: "", error: null };
    },
  });

  registry.register({
    id: ACTION_IDS.annotation_update_text,
    label: "Update Annotation Text",
    execute: (text: unknown) => {
      stores.ui.annotation_dialog = {
        ...stores.ui.annotation_dialog,
        text: String(text),
        error: null,
      };
    },
  });

  // Puts the comment after the block holding the editor selection and saves
  // through the normal, version-checked save.
  registry.register({
    id: ACTION_IDS.annotation_confirm,
    label: "Add Annotation",
    when: can_annotate,
    execute: async () => {
      const composed = services.annotation.compose(
        stores.ui.annotation_dialog.text,
      );
      if ("problem" in composed) {
        stores.ui.annotation_dialog = {
          ...stores.ui.annotation_dialog,
          error: composed.problem,
        };
        return;
      }
      if (!services.editor.insert_after_selected_block(composed.line)) {
        stores.ui.annotation_dialog = {
          ...stores.ui.annotation_dialog,
          error: "没能插入批注，请回到文档里重新选中文字",
        };
        return;
      }
      close();
      await registry.execute(ACTION_IDS.note_request_save);
    },
  });

  registry.register({
    id: ACTION_IDS.annotation_cancel,
    label: "Cancel Annotation",
    execute: close,
  });

  registry.register({
    id: ACTION_IDS.annotation_open_entry,
    label: "Open Annotation",
    execute: async (payload: unknown) => {
      const { path, line } = payload as { path: string; line: number };
      await registry.execute(ACTION_IDS.note_open, path);
      if (stores.editor.open_note?.meta.path === path)
        services.editor.reveal_line(as_note_path(path), line);
    },
  });

  registry.register({
    id: ACTION_IDS.annotation_refresh,
    label: "Refresh Annotations",
    execute: () => services.annotation.refresh(),
  });
}
