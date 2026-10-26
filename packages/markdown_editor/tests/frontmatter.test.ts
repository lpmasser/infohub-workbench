/** @vitest-environment jsdom */
import { afterEach, expect, test } from "vitest";
import { create_markdown_state } from "../src/core/editor";
import { get_blocks, is_block_rendered } from "../src/core/block_field";
import { syntaxTree } from "@codemirror/language";
import { commonmark } from "../src/plugins/commonmark/index";
import { frontmatter } from "../src/plugins/frontmatter/index";
import { is_literal } from "../src/core/context";
import { destroy_test_editors, test_editor } from "../src/testing/test_editor";

afterEach(destroy_test_editors);

const editor = (source: string) =>
  test_editor(source, [commonmark(), frontmatter()]);

function node_names(source: string) {
  const view = editor(source);
  const names: string[] = [];
  syntaxTree(view.view.state).iterate({
    enter(node) {
      names.push(node.name);
    },
  });
  return names;
}

test("SRC-011 closed frontmatter is one literal node, not a rule and a heading", () => {
  const names = node_names("---\ntitle: x\n---\n# Heading");
  expect(names).toContain("Frontmatter");
  expect(names).not.toContain("HorizontalRule");
  expect(names).not.toContain("SetextHeading2");
  expect(names).toContain("ATXHeading1");
});

test("SRC-011 an unclosed opening line stays ordinary Markdown", () => {
  const names = node_names("---\ntitle: x\n\n# Heading");
  expect(names).not.toContain("Frontmatter");
  expect(names).toContain("ATXHeading1");
});

test("SRC-011 a divider later in the note keeps divider behavior", () => {
  expect(node_names("text\n\n---\n\nmore")).toContain("HorizontalRule");
});

test("SRC-011 frontmatter is literal for menus, paste, and formatting", () => {
  const view = editor("---\ntitle: **x**\n---\nbody");
  expect(is_literal(view.view.state, 8)).toBe(true);
  expect(is_literal(view.view.state, "---\ntitle: **x**\n---\nbo".length)).toBe(
    false,
  );
});

test("SRC-011 typing the closing line turns the draft into frontmatter", () => {
  const view = editor("---\ntitle: x\n‸");
  expect(view.view.dom.querySelector(".md-frontmatter")).toBeNull();
  view.type("---");
  expect(view.view.dom.querySelector(".md-frontmatter")).not.toBeNull();
  expect(view.saved()).toBe("---\ntitle: x\n---");
});

test("properties display YAML values and list tags without rewriting comments, quotes, or CRLF", () => {
  const source =
    '---\r\n# comment\r\ntitle: "a &amp; <b>"\r\nrefs: [project-1, missing-2]\r\nenabled: true\r\n---\r\nbody';
  const view = editor(source);
  expect(
    [...view.view.dom.querySelectorAll("th")].map((el) => el.textContent),
  ).toEqual(["title", "refs", "enabled"]);
  expect(
    [...view.view.dom.querySelectorAll(".md-frontmatter-tag")].map(
      (el) => el.textContent,
    ),
  ).toEqual(["project-1", "missing-2"]);
  expect(
    view.view.dom.querySelector(".md-frontmatter-value")?.textContent,
  ).toBe("a &amp; <b>");
  expect(view.view.dom.querySelector(".md-frontmatter-table b")).toBeNull();
  expect(view.saved()).toBe(source);
});

test("entering a property reveals exact YAML for editing; leaving restores the table and undo restores source", () => {
  const source = '---\n# preserved\ntitle: "old"\n---\nbody';
  const view = editor(source);
  view.view.dom.querySelector<HTMLElement>(".md-frontmatter-value")?.click();
  expect(view.view.dom.querySelector(".md-frontmatter-table")).toBeNull();
  expect(view.saved()).toBe(source);
  expect(view.view.state.selection.main.head).toBe(source.indexOf('"old"'));
  view.view.dispatch({
    selection: {
      anchor: source.indexOf("old"),
      head: source.indexOf("old") + 3,
    },
  });
  view.type("new");
  view.view.dispatch({ selection: { anchor: view.view.state.doc.length } });
  expect(
    view.view.dom.querySelector(".md-frontmatter-value")?.textContent,
  ).toBe("new");
  view.press("Mod-z");
  expect(view.saved()).toBe(source);
});

test("invalid YAML and unsupported roots remain editable source", () => {
  for (const body of ["title: [broken", "- a\n- b", "a: 1\na: 2"]) {
    const source = `---\n${body}\n---\nbody`;
    const view = editor(source);
    expect(view.view.dom.querySelector(".md-frontmatter-table")).toBeNull();
    expect(view.saved()).toBe(source);
  }
});

test("restoring a caret into YAML and extending its selection keeps source editable until leaving the header", () => {
  const source = "---\ntitle: original\n---\nbody";
  const view = editor(source);
  view.view.dispatch({ selection: { anchor: source.indexOf("original") } });
  view.press("Shift-ArrowRight");
  expect(view.view.state.selection.main.empty).toBe(false);
  expect(view.view.dom.querySelector(".md-frontmatter-table")).toBeNull();
  view.type("O");
  expect(view.saved()).toBe(source.replace("original", "Original"));
  view.view.dispatch({ selection: { anchor: view.view.state.doc.length } });
  expect(
    view.view.dom.querySelector(".md-frontmatter-value")?.textContent,
  ).toBe("Original");
});

test("a header-only document keeps initial source visible when the first action extends its caret", () => {
  const initial = create_markdown_state("---\ntitle: x\n---", {
    plugins: [commonmark(), frontmatter()],
  });
  const state = initial.update({ selection: { anchor: 0, head: 1 } }).state;
  const block = get_blocks(state)[0];
  expect(block).toBeDefined();
  if (block) expect(is_block_rendered(state, block)).toBe(false);
});
