import { tauri_invoke } from "$lib/shared/adapters/tauri_invoke";
import type { InfoHubPort } from "../ports";
import type { Overview, HubObject, SyncStatus } from "../types/infohub";

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function strings(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}
function object(value: unknown): value is HubObject {
  return (
    record(value) &&
    typeof value.id === "string" &&
    typeof value.type === "string" &&
    typeof value.title === "string" &&
    typeof value.path === "string" &&
    record(value.frontmatter)
  );
}
function objects(value: unknown): value is HubObject[] {
  return Array.isArray(value) && value.every(object);
}
function count(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
function action_items(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        record(item) &&
        object(item.object) &&
        (item.category === "等我拍板" || item.category === "卡住了") &&
        typeof item.reason === "string",
    )
  );
}
function projects(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.every(
      (project) =>
        record(project) &&
        typeof project.id === "string" &&
        typeof project.title === "string" &&
        count(project.ongoingCount) &&
        count(project.deliveredCount) &&
        objects(project.work),
    )
  );
}
function issues(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.every(
      (i) =>
        record(i) &&
        typeof i.path === "string" &&
        typeof i.message === "string",
    )
  );
}
export function create_infohub_tauri_adapter(): InfoHubPort {
  return {
    async overview(vault_id) {
      const value = await tauri_invoke<unknown>("infohub_overview", {
        vaultId: vault_id,
      });
      if (
        !record(value) ||
        value.version !== 3 ||
        !record(value.references) ||
        !Object.values(value.references).every(
          (ref) =>
            record(ref) &&
            typeof ref.title === "string" &&
            typeof ref.path === "string",
        ) ||
        !issues(value.issues) ||
        !action_items(value.needsAction) ||
        !projects(value.projects) ||
        !count(value.deliveryWindowDays) ||
        value.deliveryWindowDays === 0
      )
        throw new Error("InfoHub 查询协议无效，请更新本机 CLI");
      return value as Overview;
    },
    async sync_status(vault_id) {
      const value = await tauri_invoke<unknown>("infohub_sync_status", {
        vaultId: vault_id,
      });
      if (
        !record(value) ||
        value.version !== 1 ||
        typeof value.running !== "boolean" ||
        (value.pending !== undefined && !record(value.pending)) ||
        (value.dirtyFiles !== undefined && !strings(value.dirtyFiles)) ||
        (value.blockedFiles !== undefined && !strings(value.blockedFiles)) ||
        (value.server != null &&
          (!record(value.server) ||
            !Array.isArray(value.server.drafts) ||
            !value.server.drafts.every(
              (d: unknown) =>
                record(d) &&
                (d.changedPaths === undefined || strings(d.changedPaths)),
            )))
      ) {
        throw new Error("InfoHub 同步状态协议无效");
      }
      return value as SyncStatus;
    },
  };
}
