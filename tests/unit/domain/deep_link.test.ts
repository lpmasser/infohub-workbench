import { expect, it } from "vitest";
import {
  document_link,
  format_deep_link,
  parse_deep_link,
} from "$lib/features/deep_link/domain/deep_link";

const at = (href: string) => parse_deep_link(new URL(href, "https://x.test"));

it("reads object, file and home addresses with source and heading", () => {
  expect(
    at("/o/work_item-32473542#%E5%B7%B2%E5%AE%9A%E6%96%B9%E6%A1%88"),
  ).toEqual({
    kind: "object",
    id: "work_item-32473542",
    source: "workspace",
    fragment: "已定方案",
  });
  expect(
    at("/f/ontomato/%E8%AE%B0%E5%BD%95/a%20b.md?source=draft%3Aabc"),
  ).toEqual({
    kind: "file",
    path: "ontomato/记录/a b.md",
    source: "draft:abc",
    fragment: null,
  });
  expect(at("/?source=main")).toEqual({
    kind: "home",
    source: "main",
    fragment: null,
  });
});

it("writes addresses that read back to the same document", () => {
  for (const link of [
    document_link("ontology-doc/工作/a b#c.md", "workspace", null),
    document_link("x.md", "main", "work_item-1"),
    { ...document_link("x.md", "draft:1-2", null), fragment: "标题 一" },
  ])
    expect(at(format_deep_link(link))).toEqual(link);
  expect(format_deep_link(document_link("x.md", "workspace", "p-1"))).toBe(
    "/o/p-1",
  );
});
