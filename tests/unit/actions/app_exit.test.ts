import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionService } from "$lib/features/session";
import { install_app_exit } from "$lib/app/orchestration/app_exit";

const boundary = vi.hoisted(() => ({
  invoke: vi.fn().mockResolvedValue(true),
  listen:
    vi.fn<
      (
        event: string,
        callback: (event: {
          payload: { id: number; updating?: boolean; automatic?: boolean };
        }) => void,
      ) => Promise<() => void>
    >(),
  error: vi.fn(),
  confirm: vi.fn().mockResolvedValue(true),
}));
vi.mock("$lib/shared/utils/detect_platform", () => ({
  detect_platform: () => ({ is_tauri: true }),
}));
vi.mock("@tauri-apps/api/core", () => ({ invoke: boundary.invoke }));
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({ listen: boundary.listen }),
}));
vi.mock("svelte-sonner", () => ({ toast: { error: boundary.error } }));

vi.mock("@tauri-apps/plugin-dialog", () => ({ confirm: boundary.confirm }));

function request_quit(request = {}) {
  const call = boundary.listen.mock.calls[0];
  if (!call) throw new Error("exit handler not registered");
  call[1]({ payload: { id: 1, ...request } });
}

describe("application exit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    boundary.listen.mockResolvedValue(vi.fn());
  });

  it("waits for session persistence before exit, coalescing repeated requests", async () => {
    let finish!: () => void;
    const save = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const dispose = install_app_exit({
      save_latest_session: save,
    } as unknown as SessionService);
    await Promise.resolve();
    request_quit();
    request_quit();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({ required: true });
    expect(boundary.invoke).not.toHaveBeenCalledWith("app_exit_complete", {
      requestId: 1,
    });
    finish();
    await vi.waitFor(() => {
      expect(boundary.invoke).toHaveBeenCalledWith("app_exit_complete", {
        requestId: 1,
      });
    });
    dispose();
  });

  it("keeps the application running if saving fails and permits a retry", async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error("disk full"))
      .mockResolvedValue(undefined);
    const dispose = install_app_exit({
      save_latest_session: save,
    } as unknown as SessionService);
    await Promise.resolve();
    request_quit();
    await vi.waitFor(() => {
      expect(boundary.error).toHaveBeenCalled();
    });
    expect(boundary.invoke).not.toHaveBeenCalledWith("app_exit_complete", {
      requestId: 1,
    });
    request_quit();
    await vi.waitFor(() => {
      expect(boundary.invoke).toHaveBeenCalledWith("app_exit_complete", {
        requestId: 1,
      });
    });
    dispose();
  });
  it("does not overwrite the previous session while startup or vault switching is still loading", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const dispose = install_app_exit(
      { save_latest_session: save } as unknown as SessionService,
      () => true,
    );
    await Promise.resolve();
    request_quit();
    await vi.waitFor(() => {
      expect(boundary.invoke).toHaveBeenCalledWith("app_exit_complete", {
        requestId: 1,
      });
    });
    expect(save).not.toHaveBeenCalled();
    dispose();
  });
});

describe("update exit protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    boundary.listen.mockResolvedValue(vi.fn());
    boundary.confirm.mockResolvedValue(true);
  });
  it("keeps an old save tied to its request and separately saves the new request", async () => {
    const finishes: Array<() => void> = [];
    const save = vi.fn(
      () => new Promise<void>((resolve) => finishes.push(resolve)),
    );
    const dispose = install_app_exit({
      save_latest_session: save,
    } as unknown as SessionService);
    await Promise.resolve();
    request_quit({ id: 1, updating: true });
    await vi.waitFor(() => {
      expect(save).toHaveBeenCalledTimes(1);
    });
    // Native cancellation followed by another request while the old save is pending.
    request_quit({ id: 2, updating: true });
    finishes[0]?.();
    await vi.waitFor(() => {
      expect(save).toHaveBeenCalledTimes(2);
    });
    expect(boundary.invoke).toHaveBeenCalledWith("app_exit_complete", {
      requestId: 1,
    });
    expect(boundary.invoke).not.toHaveBeenCalledWith("app_exit_complete", {
      requestId: 2,
    });
    finishes[1]?.();
    await vi.waitFor(() => {
      expect(boundary.invoke).toHaveBeenCalledWith("app_exit_complete", {
        requestId: 2,
      });
    });
    dispose();
  });
  it("automatic updates with dirty or loading workspaces cancel without prompts or persistence", async () => {
    for (const [loading, dirty] of [
      [true, false],
      [false, true],
    ] as const) {
      vi.clearAllMocks();
      const save = vi.fn().mockResolvedValue(undefined);
      const dispose = install_app_exit(
        { save_latest_session: save } as unknown as SessionService,
        () => loading,
        () => dirty,
      );
      await Promise.resolve();
      request_quit({ updating: true, automatic: true });
      await vi.waitFor(() => {
        expect(boundary.invoke).toHaveBeenCalledWith("app_exit_cancel", {
          requestId: 1,
        });
      });
      expect(save).not.toHaveBeenCalled();
      expect(boundary.confirm).not.toHaveBeenCalled();
      expect(boundary.error).not.toHaveBeenCalled();
      expect(boundary.invoke).not.toHaveBeenCalledWith("app_exit_complete", {
        requestId: 1,
      });
      dispose();
    }
  });
  it("typing while session persistence is in flight vetoes the automatic install", async () => {
    let finish = () => {};
    let dirty = false;
    const save = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const dispose = install_app_exit(
      { save_latest_session: save } as unknown as SessionService,
      () => false,
      () => dirty,
    );
    await Promise.resolve();
    request_quit({ updating: true, automatic: true });
    await vi.waitFor(() => {
      expect(save).toHaveBeenCalled();
    });
    dirty = true;
    finish();
    await vi.waitFor(() => {
      expect(boundary.invoke).toHaveBeenCalledWith("app_exit_cancel", {
        requestId: 1,
      });
    });
    expect(boundary.invoke).not.toHaveBeenCalledWith("app_exit_complete", {
      requestId: 1,
    });
    dispose();
  });
  it("a manual update honors cancel, then persists unsaved session contents only after confirmation", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    boundary.confirm.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const dispose = install_app_exit(
      { save_latest_session: save } as unknown as SessionService,
      () => false,
      () => true,
    );
    await Promise.resolve();
    request_quit({ updating: true, automatic: false });
    await vi.waitFor(() => {
      expect(boundary.invoke).toHaveBeenCalledWith("app_exit_cancel", {
        requestId: 1,
      });
    });
    expect(save).not.toHaveBeenCalled();
    request_quit({ updating: true, automatic: false });
    await vi.waitFor(() => {
      expect(boundary.invoke).toHaveBeenCalledWith("app_exit_complete", {
        requestId: 1,
      });
    });
    expect(save).toHaveBeenCalledWith({ required: true });
    dispose();
  });
});
