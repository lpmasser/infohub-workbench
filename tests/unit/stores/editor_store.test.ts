import { describe, expect, it } from "vitest";
import { as_markdown_text, as_note_path } from "$lib/shared/types/ids";
import { EditorStore } from "$lib/features/editor/state/editor_store.svelte";
import {
  create_open_note_state,
  create_test_note,
} from "../helpers/test_fixtures";

describe("EditorStore", () => {
  it("updates markdown and dirty state for open note", () => {
    const store = new EditorStore();
    const note = create_test_note("docs/note", "note");
    const open_note = create_open_note_state(note);

    store.set_open_note(open_note);
    store.set_markdown(note.id, as_markdown_text("# Updated"));
    store.set_dirty(note.id, true);

    expect(store.open_note?.markdown).toBe(as_markdown_text("# Updated"));
    expect(store.open_note?.is_dirty).toBe(true);
  });

  it("updates note path and title", () => {
    const store = new EditorStore();
    const note = create_test_note("docs/old", "old");

    store.set_open_note(create_open_note_state(note));
    store.update_open_note_path(as_note_path("docs/new-name.md"));

    expect(store.open_note?.meta.path).toBe(as_note_path("docs/new-name.md"));
    expect(store.open_note?.meta.title).toBe("new-name");
  });

  it("starts without a saved time when a note opens", () => {
    const store = new EditorStore();
    store.set_open_note(
      create_open_note_state(create_test_note("docs/note", "note")),
    );

    expect(store.last_saved_at).toBeNull();
  });

  it("records the save time and keeps the version when mark_clean is called with a timestamp", () => {
    const store = new EditorStore();
    const note = { ...create_test_note("docs/note", "note"), version: "v1" };

    store.set_open_note(create_open_note_state(note));
    store.set_dirty(note.id, true);
    store.mark_clean(note.id, 1_700_000_005_000);

    expect(store.open_note?.is_dirty).toBe(false);
    expect(store.last_saved_at).toBe(1_700_000_005_000);
    expect(store.open_note?.meta.version).toBe("v1");
  });

  it("preserves last_saved_at when mark_clean is called without timestamp", () => {
    const store = new EditorStore();
    const note = create_test_note("docs/note", "note");

    store.set_open_note(create_open_note_state(note));
    store.mark_clean(note.id, 1_700_000_000_000);
    store.mark_clean(note.id);

    expect(store.last_saved_at).toBe(1_700_000_000_000);
  });

  it("clears last_saved_at on clear_open_note", () => {
    const store = new EditorStore();
    const note = create_test_note("docs/note", "note");
    store.set_open_note(create_open_note_state(note));
    store.mark_clean(note.id, 1_700_000_000_000);
    store.clear_open_note();

    expect(store.last_saved_at).toBeNull();
  });

  it("clears last_saved_at on reset", () => {
    const store = new EditorStore();
    const note = create_test_note("docs/note", "note");
    store.set_open_note(create_open_note_state(note));
    store.mark_clean(note.id, 1_700_000_000_000);
    store.reset();

    expect(store.last_saved_at).toBeNull();
  });

  describe("session_persist_revision", () => {
    it("bumps when persisted editor state changes", () => {
      const store = new EditorStore();
      const note = create_test_note("docs/note", "note");
      const open_note = create_open_note_state(note);
      const previous_revision = store.session_persist_revision;

      store.set_open_note(open_note);

      expect(store.session_persist_revision).toBe(previous_revision + 1);
    });

    it("does not bump when markdown is unchanged", () => {
      const store = new EditorStore();
      const note = create_test_note("docs/note", "note");
      const open_note = create_open_note_state(note, "# Same");

      store.set_open_note(open_note);
      const previous_revision = store.session_persist_revision;

      store.set_markdown(note.id, as_markdown_text("# Same"));

      expect(store.session_persist_revision).toBe(previous_revision);
    });

    it("does not bump when cursor is unchanged", () => {
      const store = new EditorStore();
      const note = create_test_note("docs/note", "note");
      const cursor = {
        line: 1,
        column: 1,
        total_lines: 1,
        total_words: 1,
        anchor: 1,
        head: 1,
      };

      store.set_open_note(create_open_note_state(note));
      store.set_cursor(note.id, cursor);
      const previous_revision = store.session_persist_revision;

      store.set_cursor(note.id, { ...cursor });

      expect(store.session_persist_revision).toBe(previous_revision);
    });

    it("does not bump when reset is called on an empty store", () => {
      const store = new EditorStore();
      const previous_revision = store.session_persist_revision;

      store.reset();

      expect(store.session_persist_revision).toBe(previous_revision);
    });
  });
});
