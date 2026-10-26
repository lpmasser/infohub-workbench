import { expect, it, vi } from "vitest";
import { create_infohub_tauri_adapter } from "$lib/features/infohub/adapters/infohub_tauri_adapter";
import { as_vault_id } from "$lib/shared/types/ids";
import { infohub_overview } from "../helpers/infohub_fixtures";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("$lib/shared/adapters/tauri_invoke", () => ({ tauri_invoke: invoke }));

it("accepts the core's versioned action and project snapshot, including an empty result", async () => {
  const adapter = create_infohub_tauri_adapter();
  for (const snapshot of [
    infohub_overview("待处理文档"),
    {
      version: 3,
      references: {},
      needsAction: [],
      projects: [],
      deliveryWindowDays: 14,
      issues: [],
    },
  ]) {
    invoke.mockResolvedValue(snapshot);
    expect(await adapter.overview(as_vault_id("vault"))).toEqual(snapshot);
  }
});

it("rejects old or damaged overview protocols instead of displaying an empty or misleading summary", async () => {
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
    invoke.mockResolvedValue(value);
    await expect(
      create_infohub_tauri_adapter().overview(as_vault_id("vault")),
    ).rejects.toThrow("协议无效");
  }
});
