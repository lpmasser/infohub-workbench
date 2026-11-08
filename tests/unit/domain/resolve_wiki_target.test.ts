import { expect, it } from "vitest";
import { resolve_wiki_target } from "$lib/features/search/domain/resolve_wiki_target";

// Same cases as the desktop backend's resolve_wiki_target.
it("resolves link targets like the desktop backend", () => {
  const cases: Array<[string, string, string | null]> = [
    ["docs/工作/a.md", "./b", "docs/工作/b.md"],
    ["docs/工作/a.md", "../能力/c.md", "docs/能力/c.md"],
    ["docs/a.md", "/top/note", "top/note.md"],
    ["docs/a.md", "plain/name", "plain/name.md"],
    ["a.md", "../outside", null],
    ["docs/a.md", "/", null],
  ];
  for (const [source, target, expected] of cases)
    expect(resolve_wiki_target(source, target)).toBe(expected);
});
