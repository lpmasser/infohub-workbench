import { expect, it } from "vitest";
import {
  annotation_text_problem,
  format_annotation,
  local_date,
  parse_annotation,
} from "$lib/features/annotation/domain/annotation";

it("reads the written form and the accepted half-width colon", () => {
  expect(
    parse_annotation(
      "<!-- 批注 2026-11-09 lpmasser：时间不对，应该是 11-06 -->",
    ),
  ).toEqual({
    date: "2026-11-09",
    author: "lpmasser",
    text: "时间不对，应该是 11-06",
  });
  expect(
    parse_annotation("<!-- 批注 2026-11-09 agent: 多行\n第二行 -->"),
  ).toEqual({ date: "2026-11-09", author: "agent", text: "多行\n第二行" });
});

it("leaves other comments and malformed annotations alone", () => {
  for (const source of [
    "<!-- plain -->",
    "<!-- 批注 2026-13-40 a：x -->",
    "<!-- 批注 2026-11-09 a： -->",
    "<!-- 批注 2026-11-09 ：x -->",
    "<!-- 批注 2026-11-09 a：<!-- x -->",
  ])
    expect(parse_annotation(source)).toBeNull();
});

it("writes what it reads, with the full-width colon", () => {
  const annotation = { date: "2026-11-09", author: "eloy", text: "请核对" };
  const line = format_annotation(annotation);
  expect(line).toBe("<!-- 批注 2026-11-09 eloy：请核对 -->");
  expect(parse_annotation(line)).toEqual(annotation);
  expect(annotation_text_problem("a --> b")).not.toBeNull();
  expect(annotation_text_problem("  ")).not.toBeNull();
  expect(local_date(new Date(2026, 10, 9, 23, 30).getTime())).toBe(
    "2026-11-09",
  );
});
