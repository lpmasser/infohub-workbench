/** @vitest-environment jsdom */
import { afterEach, expect, test, vi } from "vitest";
import { commonmark } from "../src/plugins/commonmark/index";
import { gfm } from "../src/plugins/gfm/index";
import {
  annotations,
  insert_after_selected_block,
  type AnnotationNote,
} from "../src/plugins/annotations/index";
import { destroy_test_editors, test_editor } from "../src/testing/test_editor";

afterEach(destroy_test_editors);

const pattern = /^<!-- note (\S+) (\S+): ([\s\S]*?) -->$/;
const parse = (source: string): AnnotationNote | null => {
  const match = pattern.exec(source);
  return match
    ? { date: match[1] ?? "", author: match[2] ?? "", text: match[3] ?? "" }
    : null;
};

const editor = (source: string, on_request?: () => void) =>
  test_editor(source, [
    commonmark(),
    gfm(),
    annotations({
      parse,
      can_remove: (note) => note.author === "me",
      ...(on_request ? { on_request } : {}),
    }),
  ]);

test("a note comment renders as a card; other comments stay source", () => {
  const view = editor(
    "‸# T\n\npara\n<!-- note 2026-11-09 me: fix this -->\n\n<!-- plain -->",
  );
  const cards = view.view.dom.querySelectorAll(".md-annotation");
  expect(cards).toHaveLength(1);
  expect(cards[0]?.textContent).toContain("fix this");
  expect(view.view.dom.textContent).toContain("<!-- plain -->");
});

test("inserting after a paragraph adds only the note line", () => {
  const view = editor(
    "# T\r\n\r\nfirst ‹line‸ of a\r\nparagraph\r\n\r\nnext\r\n",
  );
  insert_after_selected_block(view.view, "<!-- note 2026-11-09 me: hi -->");
  expect(view.saved()).toBe(
    "# T\r\n\r\nfirst line of a\r\nparagraph\r\n<!-- note 2026-11-09 me: hi -->\r\n\r\nnext\r\n",
  );
});

test("inserting from inside a list or table goes after the whole block", () => {
  const list = editor("- a‸\n- b\n\nafter");
  insert_after_selected_block(list.view, "<!-- note d me: x -->");
  expect(list.saved()).toBe("- a\n- b\n<!-- note d me: x -->\n\nafter");
  const table = editor("| a |\n| - |\n| b‸ |\n\nafter");
  insert_after_selected_block(table.view, "<!-- note d me: x -->");
  expect(table.saved()).toBe(
    "| a |\n| - |\n| b |\n<!-- note d me: x -->\n\nafter",
  );
});

test("removing an own note deletes exactly its line; others have no button", () => {
  const view = editor(
    "‸para\n<!-- note d me: mine -->\n<!-- note d you: theirs -->\nend",
  );
  const buttons = view.view.dom.querySelectorAll<HTMLButtonElement>(
    ".md-annotation-remove",
  );
  expect(buttons).toHaveLength(1);
  buttons[0]?.click();
  expect(view.saved()).toBe("para\n<!-- note d you: theirs -->\nend");
});

test("a selection offers the note button, which keeps the selection", () => {
  const request = vi.fn();
  const view = editor("pa‹ra‸ text", request);
  const button = view.view.dom.querySelector<HTMLButtonElement>(
    ".md-annotation-button button",
  );
  expect(button).not.toBeNull();
  button?.click();
  expect(request).toHaveBeenCalledOnce();
  expect(view.view.state.selection.main.empty).toBe(false);
});
