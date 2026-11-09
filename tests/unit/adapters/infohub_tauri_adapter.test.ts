import { expect, it, vi } from "vitest";
import { create_infohub_tauri_adapter } from "$lib/features/infohub/adapters/infohub_tauri_adapter";
import { as_vault_id } from "$lib/shared/types/ids";
import { infohub_overview } from "../helpers/infohub_fixtures";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("$lib/shared/adapters/tauri_invoke", () => ({ tauri_invoke: invoke }));

it("accepts the core's versioned action and project snapshot, including an empty result", async () => {
  const adapter = create_infohub_tauri_adapter();
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

it("polls the local sync status until stopped, reporting each result", async () => {
  vi.useFakeTimers();
  try {
    const seen: unknown[] = [];
    invoke.mockResolvedValue({
      version: 1,
      running: true,
      dirtyFiles: ["a.md"],
    });
    const stop = create_infohub_tauri_adapter().watch_sync_status(
      as_vault_id("vault"),
      {
        on_status: (status) => seen.push(status.dirtyFiles),
        on_error: () => {},
      },
    );
    await vi.advanceTimersByTimeAsync(0);
    invoke.mockResolvedValue({
      version: 1,
      running: true,
      dirtyFiles: ["b.md"],
    });
    await vi.advanceTimersByTimeAsync(5000);
    stop();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(seen).toEqual([["a.md"], ["b.md"]]);
  } finally {
    vi.useRealTimers();
  }
});
