import type { NotesPort, NotesStore } from "$lib/features/note";
import type { VaultStore } from "$lib/features/vault";
import type { EditorStore } from "$lib/features/editor";
import type { OpStore } from "$lib/app";
import type { TabStore } from "$lib/features/tab";
import type {
  FolderLoadResult,
  FolderMoveResult,
} from "$lib/features/folder/types/folder_service_result";
import type { MoveItem } from "$lib/shared/types/filetree";
import { PAGE_SIZE } from "$lib/shared/constants/pagination";
import { error_message } from "$lib/shared/utils/error_message";
import { create_logger } from "$lib/shared/utils/logger";
import { move_destination_path } from "$lib/features/folder/domain/filetree";
import { as_note_path, type VaultId } from "$lib/shared/types/ids";

const log = create_logger("folder_service");
type MoveItemResult = Awaited<ReturnType<NotesPort["move_items"]>>[number];

export class FolderService {
  constructor(
    private readonly notes_port: NotesPort,
    private readonly vault_store: VaultStore,
    private readonly notes_store: NotesStore,
    private readonly editor_store: EditorStore,
    private readonly tab_store: TabStore,
    private readonly op_store: OpStore,
    private readonly now_ms: () => number,
  ) {}

  private get_active_vault_id(): VaultId | null {
    return this.vault_store.vault?.id ?? null;
  }

  private is_stale_generation(expected_generation: number): boolean {
    return expected_generation !== this.vault_store.generation;
  }

  private start_operation(operation_key: string): void {
    this.op_store.start(operation_key, this.now_ms());
  }

  private succeed_operation(operation_key: string): void {
    this.op_store.succeed(operation_key);
  }

  private fail_operation(
    operation_key: string,
    log_message: string,
    error: unknown,
    details?: Record<string, unknown>,
  ): string {
    const message = error_message(error);
    log.error(
      log_message,
      details ? { ...details, error: message } : { error: message },
    );
    this.op_store.fail(operation_key, message);
    return message;
  }

  // Only files move; the server refuses folders.
  private apply_move_result(result: MoveItemResult): void {
    const old_note_path = as_note_path(result.path);
    const new_note_path = as_note_path(result.new_path);
    this.notes_store.rename_note(old_note_path, new_note_path);

    if (this.editor_store.open_note?.meta.id === old_note_path) {
      this.editor_store.update_open_note_path(new_note_path);
    }

    const renamed_note = this.notes_store.notes.find(
      (note) => note.path === new_note_path,
    );
    if (renamed_note) {
      this.notes_store.rename_recent_note(old_note_path, renamed_note);
    }

    this.tab_store.update_tab_path(old_note_path, new_note_path);
  }

  private async load_folder_slice(
    path: string,
    offset: number,
    expected_generation: number,
    apply_contents: (
      path: string,
      contents: Awaited<ReturnType<NotesPort["list_folder_contents"]>>,
    ) => void,
  ): Promise<FolderLoadResult> {
    const vault_id = this.get_active_vault_id();
    if (!vault_id) {
      return { status: "skipped" };
    }

    if (this.is_stale_generation(expected_generation)) {
      return { status: "stale" };
    }

    try {
      const contents = await this.notes_port.list_folder_contents(
        vault_id,
        path,
        offset,
        PAGE_SIZE,
      );

      if (this.is_stale_generation(expected_generation)) {
        return { status: "stale" };
      }

      apply_contents(path, contents);
      return {
        status: "loaded",
        total_count: contents.total_count,
        has_more: contents.has_more,
      };
    } catch (error) {
      if (this.is_stale_generation(expected_generation)) {
        return { status: "stale" };
      }

      const message = error_message(error);
      log.error("Load folder contents failed", {
        path,
        error: message,
        offset,
      });
      return {
        status: "failed",
        error: message,
      };
    }
  }

  async move_items(
    items: MoveItem[],
    target_folder: string,
    overwrite: boolean,
  ): Promise<FolderMoveResult> {
    const vault_id = this.get_active_vault_id();
    if (!vault_id || items.length === 0) {
      return { status: "skipped" };
    }

    this.start_operation("folder.move");

    try {
      const results = await this.notes_port.move_items(
        vault_id,
        items,
        target_folder,
        overwrite,
      );

      for (const result of results)
        if (result.success) this.apply_move_result(result);

      this.succeed_operation("folder.move");
      return { status: "success", results };
    } catch (error) {
      const message = this.fail_operation(
        "folder.move",
        "Move items failed",
        error,
        { target_folder },
      );
      return {
        status: "failed",
        error: message,
      };
    }
  }

  async load_folder(
    path: string,
    expected_generation: number,
  ): Promise<FolderLoadResult> {
    return this.load_folder_slice(
      path,
      0,
      expected_generation,
      (folder_path, contents) => {
        this.notes_store.merge_folder_contents(folder_path, contents);
      },
    );
  }

  async load_folder_page(
    path: string,
    offset: number,
    expected_generation: number,
  ): Promise<FolderLoadResult> {
    return this.load_folder_slice(
      path,
      offset,
      expected_generation,
      (folder_path, contents) => {
        this.notes_store.append_folder_page(folder_path, contents);
      },
    );
  }

  build_move_preview(items: MoveItem[], target_folder: string) {
    return items.map((item) => ({
      ...item,
      new_path: move_destination_path(item.path, target_folder),
    }));
  }
}
