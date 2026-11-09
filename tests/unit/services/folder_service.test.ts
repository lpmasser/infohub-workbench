import { describe, expect, it, vi } from "vitest";
import { FolderService } from "$lib/features/folder/application/folder_service";
import { VaultStore } from "$lib/features/vault/state/vault_store.svelte";
import { NotesStore } from "$lib/features/note/state/note_store.svelte";
import { EditorStore } from "$lib/features/editor/state/editor_store.svelte";
import { OpStore } from "$lib/app/orchestration/op_store.svelte";
import { TabStore } from "$lib/features/tab/state/tab_store.svelte";
import { as_markdown_text, as_note_path } from "$lib/shared/types/ids";
import { to_open_note_state } from "$lib/shared/types/editor";
import { create_test_vault } from "../helpers/test_fixtures";
import { create_mock_notes_port } from "../helpers/mock_ports";

function create_note(index: number) {
  const file = `note-${String(index).padStart(3, "0")}.md`;
  const path = as_note_path(file);
  return {
    id: path,
    path,
    name: file.replace(".md", ""),
    title: file.replace(".md", ""),
    version: null,
    size_bytes: 0,
  };
}

describe("FolderService", () => {
  it("loads first page and reports pagination metadata", async () => {
    const vault_store = new VaultStore();
    const notes_store = new NotesStore();
    const editor_store = new EditorStore();
    const op_store = new OpStore();
    const notes_port = create_mock_notes_port();

    const vault = create_test_vault();
    vault_store.set_vault(vault);
    notes_port._mock_notes.set(vault.id, [create_note(1), create_note(2)]);
    notes_port._mock_folders.set(vault.id, ["docs"]);

    const service = new FolderService(
      notes_port,
      vault_store,
      notes_store,
      editor_store,
      new TabStore(),
      op_store,
      () => 1,
    );

    const result = await service.load_folder("", vault_store.generation);

    expect(result).toEqual({
      status: "loaded",
      total_count: 3,
      has_more: false,
    });
    expect(notes_store.notes.map((note) => note.path)).toEqual([
      "note-001.md",
      "note-002.md",
    ]);
    expect(notes_store.folder_paths).toEqual(["docs"]);
  });

  it("loads additional pages additively", async () => {
    const vault_store = new VaultStore();
    const notes_store = new NotesStore();
    const editor_store = new EditorStore();
    const op_store = new OpStore();
    const notes_port = create_mock_notes_port();

    const vault = create_test_vault();
    vault_store.set_vault(vault);

    const many_notes = Array.from({ length: 205 }, (_, index) =>
      create_note(index + 1),
    );
    notes_port._mock_notes.set(vault.id, many_notes);

    const service = new FolderService(
      notes_port,
      vault_store,
      notes_store,
      editor_store,
      new TabStore(),
      op_store,
      () => 1,
    );

    const first = await service.load_folder("", vault_store.generation);
    expect(first).toEqual({
      status: "loaded",
      total_count: 205,
      has_more: true,
    });
    expect(notes_store.notes).toHaveLength(200);

    const second = await service.load_folder_page(
      "",
      200,
      vault_store.generation,
    );
    expect(second).toEqual({
      status: "loaded",
      total_count: 205,
      has_more: false,
    });
    expect(notes_store.notes).toHaveLength(205);
  });

  it("returns stale and does not mutate when generation changed", async () => {
    const vault_store = new VaultStore();
    const notes_store = new NotesStore();
    const editor_store = new EditorStore();
    const op_store = new OpStore();
    const tab_store = new TabStore();
    const notes_port = create_mock_notes_port();

    const vault = create_test_vault();
    vault_store.set_vault(vault);
    notes_port._mock_notes.set(vault.id, [create_note(1)]);

    const service = new FolderService(
      notes_port,
      vault_store,
      notes_store,
      editor_store,
      tab_store,
      op_store,
      () => 1,
    );

    const generation = vault_store.generation;
    vault_store.bump_generation();

    const result = await service.load_folder_page("", 0, generation);

    expect(result).toEqual({ status: "stale" });
    expect(notes_store.notes).toEqual([]);
  });

  it("move_items updates stores for moved notes and leaves a refused folder move alone", async () => {
    const vault_store = new VaultStore();
    const notes_store = new NotesStore();
    const editor_store = new EditorStore();
    const op_store = new OpStore();
    const tab_store = new TabStore();
    const notes_port = create_mock_notes_port();

    const vault = create_test_vault();
    vault_store.set_vault(vault);

    const note_meta = {
      ...create_note(1),
      path: as_note_path("docs/note-001.md"),
      id: as_note_path("docs/note-001.md"),
    };
    const folder_note = {
      ...create_note(2),
      path: as_note_path("work/todo.md"),
      id: as_note_path("work/todo.md"),
    };
    notes_store.set_notes([note_meta, folder_note]);
    notes_store.set_folder_paths(["docs", "work"]);
    notes_store.add_recent_note(note_meta);
    notes_store.add_recent_note(folder_note);
    tab_store.open_tab(as_note_path("docs/note-001.md"), "note-001");
    tab_store.open_tab(as_note_path("work/todo.md"), "todo");

    notes_port.move_items = vi.fn().mockResolvedValue([
      {
        path: "docs/note-001.md",
        new_path: "archive/note-001.md",
        success: true,
        error: null,
      },
      {
        path: "work",
        new_path: "archive/work",
        success: false,
        error: "不能移动文件夹，请逐个移动文件",
      },
    ]);

    const service = new FolderService(
      notes_port,
      vault_store,
      notes_store,
      editor_store,
      tab_store,
      op_store,
      () => 1,
    );

    const result = await service.move_items(
      [
        { path: "docs/note-001.md", is_folder: false },
        { path: "work", is_folder: true },
      ],
      "archive",
      false,
    );

    expect(result.status).toBe("success");
    expect(notes_store.notes.map((note) => note.path)).toEqual([
      "archive/note-001.md",
      "work/todo.md",
    ]);
    expect(tab_store.tabs.map((tab) => tab.note_path)).toEqual([
      "archive/note-001.md",
      "work/todo.md",
    ]);
  });

  it("move_items preserves successful entries when some fail", async () => {
    const vault_store = new VaultStore();
    const notes_store = new NotesStore();
    const editor_store = new EditorStore();
    const op_store = new OpStore();
    const tab_store = new TabStore();
    const notes_port = create_mock_notes_port();

    const vault = create_test_vault();
    vault_store.set_vault(vault);

    const note_meta = {
      ...create_note(1),
      path: as_note_path("docs/note-001.md"),
      id: as_note_path("docs/note-001.md"),
    };
    notes_store.set_notes([note_meta]);
    notes_store.set_folder_paths(["docs"]);

    notes_port.move_items = vi.fn().mockResolvedValue([
      {
        path: "docs/note-001.md",
        new_path: "archive/note-001.md",
        success: true,
        error: null,
      },
      {
        path: "missing.md",
        new_path: "archive/missing.md",
        success: false,
        error: "source not found",
      },
    ]);

    const service = new FolderService(
      notes_port,
      vault_store,
      notes_store,
      editor_store,
      tab_store,
      op_store,
      () => 1,
    );

    const result = await service.move_items(
      [
        { path: "docs/note-001.md", is_folder: false },
        { path: "missing.md", is_folder: false },
      ],
      "archive",
      false,
    );

    expect(result.status).toBe("success");
    expect(notes_store.notes.map((note) => note.path)).toEqual([
      "archive/note-001.md",
    ]);
  });

  it("move_items does not retarget open note when moving another note", async () => {
    const vault_store = new VaultStore();
    const notes_store = new NotesStore();
    const editor_store = new EditorStore();
    const op_store = new OpStore();
    const tab_store = new TabStore();
    const notes_port = create_mock_notes_port();

    const vault = create_test_vault();
    vault_store.set_vault(vault);

    const first_note = {
      ...create_note(1),
      path: as_note_path("docs/first.md"),
      id: as_note_path("docs/first.md"),
      title: "First",
      name: "first",
    };
    const second_note = {
      ...create_note(2),
      path: as_note_path("docs/second.md"),
      id: as_note_path("docs/second.md"),
      title: "Second",
      name: "second",
    };
    notes_store.set_notes([first_note, second_note]);
    editor_store.set_open_note(
      to_open_note_state({
        meta: second_note,
        markdown: as_markdown_text("SECOND_CONTENT"),
      }),
    );

    notes_port.move_items = vi.fn().mockResolvedValue([
      {
        path: "docs/first.md",
        new_path: "archive/first.md",
        success: true,
        error: null,
      },
    ]);

    const service = new FolderService(
      notes_port,
      vault_store,
      notes_store,
      editor_store,
      tab_store,
      op_store,
      () => 1,
    );

    const result = await service.move_items(
      [{ path: "docs/first.md", is_folder: false }],
      "archive",
      false,
    );

    expect(result.status).toBe("success");
    expect(editor_store.open_note?.meta.path).toBe("docs/second.md");
    expect(editor_store.open_note?.markdown).toBe("SECOND_CONTENT");
  });
});
