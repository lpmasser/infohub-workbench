/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { flushSync } from "svelte";
import { create_filetree_follow_reactor } from "$lib/reactors/filetree_follow.reactor.svelte";
import { EditorStore } from "$lib/features/editor";
import { UIStore } from "$lib/app";
import { ACTION_IDS } from "$lib/app/action_registry/action_ids";
import type { ActionRegistry } from "$lib/app/action_registry/action_registry";
import { as_markdown_text, as_note_path } from "$lib/shared/types/ids";
import {
  create_open_note_state,
  create_test_note,
} from "../helpers/test_fixtures";

// The public Svelte entry resolves to the server build in Vitest; effects use the client runtime.
vi.mock("svelte", async () => {
  const api = await vi.importActual<typeof import("svelte")>("svelte");
  const client = await vi.importActual<{
    untrack: (typeof import("svelte"))["untrack"];
    flush: (typeof import("svelte"))["flushSync"];
  }>("svelte/internal/client");
  return { ...api, untrack: client.untrack, flushSync: client.flush };
});

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

function setup() {
  const editor_store = new EditorStore();
  const ui_store = new UIStore();
  const execute = vi.fn();
  cleanups.push(
    create_filetree_follow_reactor({
      editor_store,
      ui_store,
      action_registry: { execute } as unknown as ActionRegistry,
    }),
  );
  flushSync();
  const open = (path: string) => {
    editor_store.set_open_note(
      create_open_note_state(create_test_note(path.replace(/\.md$/, ""), path)),
    );
    flushSync();
  };
  const revealed = () =>
    execute.mock.calls
      .filter(([id]) => id === ACTION_IDS.filetree_reveal_note)
      .map(([, payload]) => (payload as { note_path: string }).note_path);
  return { editor_store, ui_store, open, revealed };
}

describe("filetree_follow.reactor", () => {
  it("reveals each newly opened document without switching the sidebar view", () => {
    const { open, revealed } = setup();

    open("docs/a.md");
    open("docs/specs/b.md");

    expect(revealed()).toEqual(["docs/a.md", "docs/specs/b.md"]);
  });

  it("does not reveal again while the same document is edited", () => {
    const { editor_store, open, revealed } = setup();

    open("docs/a.md");
    editor_store.set_markdown(
      as_note_path("docs/a.md"),
      as_markdown_text("edited"),
    );
    flushSync();

    expect(revealed()).toEqual(["docs/a.md"]);
  });

  it("waits while the file tree is hidden and catches up when it is shown", () => {
    const { ui_store, open, revealed } = setup();

    ui_store.sidebar_open = false;
    flushSync();
    open("docs/a.md");
    ui_store.set_sidebar_view("starred");
    flushSync();
    open("docs/b.md");
    expect(revealed()).toEqual([]);

    ui_store.set_sidebar_view("explorer");
    flushSync();
    expect(revealed()).toEqual(["docs/b.md"]);
  });

  it("does nothing when auto reveal is turned off", () => {
    const { ui_store, open, revealed } = setup();

    ui_store.editor_settings.filetree_auto_reveal = false;
    open("docs/a.md");

    expect(revealed()).toEqual([]);
  });
});
