import type { InfoHubPort } from "../ports";
import { parse_overview, parse_sync_status } from "../domain/parse_infohub";
import {
  WORKSPACE_SOURCE,
  is_web_api_error,
  type WebApi,
} from "$lib/shared/adapters/web/web_api";
import type { WebEvents } from "$lib/shared/adapters/web/web_events";

// Queries run on the server against the user's workspace, whichever source
// the page shows: summaries and object titles describe the user's own copy.
export function create_infohub_web_adapter(
  api: WebApi,
  events: WebEvents,
): InfoHubPort {
  return {
    async overview() {
      return parse_overview(
        await api
          .request("GET", "/api/overview", {
            query: { source: WORKSPACE_SOURCE },
          })
          .then((response) => response.json()),
      );
    },
    // `get` answers an unknown id with QUERY_ERROR, the CLI's "not found".
    async object_path(id) {
      try {
        const result = await api.get_json<{ object?: { path?: unknown } }>(
          "/api/get",
          1,
          { source: WORKSPACE_SOURCE, target: id },
        );
        const path = result.object?.path;
        if (typeof path !== "string")
          throw new Error("InfoHub 对象查询响应无效，请刷新页面或更新前端");
        return path;
      } catch (error) {
        if (is_web_api_error(error, 400, "QUERY_ERROR")) return null;
        throw error;
      }
    },
    // The event stream sends the status on connect and on every change.
    watch_sync_status(_vault_id, handlers) {
      let stopped = false;
      const report = (value: unknown) => {
        if (stopped) return;
        try {
          handlers.on_status(parse_sync_status(value));
        } catch (error) {
          handlers.on_error(error);
        }
      };
      const stop = events.subscribe((event) => {
        if (event.type === "sync") report(event.status);
      });
      api
        .request("GET", "/api/sync/status", {
          query: { source: WORKSPACE_SOURCE },
        })
        .then((response) => response.json())
        .then(report)
        .catch((error: unknown) => {
          if (!stopped) handlers.on_error(error);
        });
      return () => {
        stopped = true;
        stop();
      };
    },
  };
}
