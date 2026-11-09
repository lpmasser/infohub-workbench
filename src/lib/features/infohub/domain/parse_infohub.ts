import type { HubObject, Overview, SyncStatus } from "../types/infohub";

// The CLI's versioned JSON is checked where it enters the app. A protocol the
// page does not understand is an error, never an empty or partial summary:
// silently dropping an item that needs the user is worse than failing.

const ACTION_CATEGORIES: ReadonlySet<unknown> = new Set([
  "卡住了",
  "等我拍板",
  "停滞",
]);

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
        ACTION_CATEGORIES.has(item.category) &&
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

export function parse_overview(value: unknown): Overview {
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
}

export function parse_sync_status(value: unknown): SyncStatus {
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
}
