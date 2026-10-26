import type { SessionService } from "$lib/features/session";
import { detect_platform } from "$lib/shared/utils/detect_platform";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { confirm } from "@tauri-apps/plugin-dialog";
import { toast } from "svelte-sonner";

interface ExitRequest {
  id: number;
  updating?: boolean;
  automatic?: boolean;
}

export function install_app_exit(
  session: SessionService,
  is_loading: () => boolean = () => false,
  has_unsaved: () => boolean = () => false,
): () => void {
  if (!detect_platform().is_tauri) return () => {};
  let disposed = false;
  let saving_id: number | undefined;
  let queued: ExitRequest | undefined;
  let unlisten: (() => void) | undefined;
  async function quit(request: ExitRequest) {
    if (saving_id !== undefined) {
      if (saving_id !== request.id) queued = request;
      return;
    }
    saving_id = request.id;
    const args = { requestId: request.id };
    try {
      if (
        request.updating &&
        (is_loading() || (request.automatic && has_unsaved()))
      ) {
        await invoke("app_exit_cancel", args);
        return;
      }
      if (request.updating && !request.automatic && has_unsaved()) {
        const proceed = await confirm(
          "有未保存内容。将按现有退出流程保留到会话，更新后恢复。",
          {
            title: "重启以更新",
            okLabel: "保留并重启",
            cancelLabel: "取消",
          },
        );
        if (!proceed) {
          await invoke("app_exit_cancel", args);
          return;
        }
      }
      if (
        request.updating &&
        !(await invoke<boolean>("app_exit_prepare_update", args))
      )
        return;
      if (!is_loading()) await session.save_latest_session({ required: true });
      // Edits made while persistence was in flight veto an automatic update.
      if (request.automatic && (is_loading() || has_unsaved()))
        await invoke("app_exit_cancel", args);
      else await invoke("app_exit_complete", args);
    } catch (error) {
      await invoke("app_exit_cancel", args);
      if (!request.automatic)
        toast.error(`无法退出：保存工作区失败，${String(error)}`);
    } finally {
      saving_id = undefined;
      const next = queued;
      queued = undefined;
      if (next && !disposed) void quit(next);
    }
  }
  void getCurrentWindow()
    .listen<ExitRequest>("app-exit-requested", (event) => {
      void quit(event.payload);
    })
    .then(async (stop) => {
      if (disposed) {
        stop();
        return;
      }
      unlisten = stop;
      await invoke("app_exit_ready", { ready: true });
      if (disposed) await invoke("app_exit_ready", { ready: false });
    });
  return () => {
    disposed = true;
    unlisten?.();
    void invoke("app_exit_ready", { ready: false });
  };
}

export async function publish_update_blocked(blocked: boolean): Promise<void> {
  if (detect_platform().is_tauri)
    await invoke("app_update_blocked", { blocked });
}
