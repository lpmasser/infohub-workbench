import { expect, it } from "vitest";
import { parse_overview } from "$lib/features/infohub/domain/parse_infohub";
import { infohub_overview } from "../helpers/infohub_fixtures";

it("accepts the core's versioned action and project snapshot, including an empty result", () => {
  const stalled = infohub_overview("长时间没动的工作");
  for (const snapshot of [
    infohub_overview("待处理文档"),
    // The core reports untouched work as 停滞 alongside 卡住了 and 等我拍板.
    {
      ...stalled,
      needsAction: [{ ...stalled.needsAction[0], category: "停滞" }],
    },
    {
      version: 3,
      references: {},
      needsAction: [],
      projects: [],
      deliveryWindowDays: 14,
      issues: [],
    },
  ]) {
    expect(parse_overview(snapshot)).toEqual(snapshot);
  }
});

it("rejects old or damaged overview protocols instead of displaying an empty or misleading summary", () => {
  const valid = infohub_overview("需要关注");
  for (const value of [
    { ...valid, version: 2 },
    { ...valid, references: null },
    { ...valid, references: { broken: { title: "x" } } },
    { version: 1, work: [], attention: [], projects: [], issues: [] },
    {
      ...valid,
      needsAction: [{ ...valid.needsAction[0], category: "unknown" }],
    },
    { ...valid, needsAction: [{ ...valid.needsAction[0], reason: null }] },
    { ...valid, projects: [{ ...valid.projects[0], ongoingCount: "1" }] },
    { ...valid, projects: [{ ...valid.projects[0], deliveredCount: -1 }] },
    { ...valid, projects: [{ ...valid.projects[0], work: [{}] }] },
    { ...valid, deliveryWindowDays: 0 },
  ]) {
    expect(() => parse_overview(value)).toThrow("协议无效");
  }
});
