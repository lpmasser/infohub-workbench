import {
  is_web_api_error,
  type WebApi,
} from "$lib/shared/adapters/web/web_api";
import type { WebFileChange } from "$lib/shared/adapters/web/web_files";

// "ready" and "resync" mean the server has no event history for this client:
// every snapshot (tree, open documents, queries, sources) must be read again.
export type WebEvent =
  | { type: "snapshot_lost" }
  | { type: "files"; changes: WebFileChange[] }
  | { type: "sync"; status: unknown };

type Listener = (event: WebEvent) => void;

const RECONNECT_DELAYS_MS = [1000, 2000, 5000, 10000, 30000];

function parse(data: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(data);
    return typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function file_changes(value: unknown): WebFileChange[] | null {
  if (!Array.isArray(value)) return null;
  const changes: WebFileChange[] = [];
  for (const item of value) {
    if (
      typeof item !== "object" ||
      item === null ||
      typeof (item as { path?: unknown }).path !== "string"
    )
      return null;
    const { path, version } = item as { path: string; version?: unknown };
    if (typeof version !== "string" && version !== null) return null;
    changes.push({ path, version });
  }
  return changes;
}

// One EventSource per page, shared by every adapter that needs live changes.
export class WebEvents {
  private readonly listeners = new Set<Listener>();
  private source: EventSource | null = null;
  private reconnect_timer: ReturnType<typeof setTimeout> | null = null;
  private failures = 0;
  private stopped = false;
  private signed_out = false;

  constructor(private readonly api: WebApi) {}

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    this.stopped = false;
    if (!this.source && !this.reconnect_timer) this.connect();
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) this.close();
    };
  }

  // After signing in again. The new connection starts with "ready", so every
  // listener rebuilds its snapshot.
  resume(): void {
    if (!this.signed_out) return;
    this.signed_out = false;
    this.failures = 0;
    if (!this.source && !this.reconnect_timer && this.listeners.size > 0)
      this.connect();
  }

  close(): void {
    this.stopped = true;
    if (this.reconnect_timer) clearTimeout(this.reconnect_timer);
    this.reconnect_timer = null;
    this.source?.close();
    this.source = null;
  }

  private emit(event: WebEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  private protocol_error(name: string): void {
    // A payload we cannot read means our view is no longer trustworthy.
    console.error(`[web_events] unreadable ${name} event`);
    this.emit({ type: "snapshot_lost" });
  }

  private connect(): void {
    if (this.stopped) return;
    const source = new EventSource("/api/events");
    this.source = source;
    source.addEventListener("ready", () => {
      this.failures = 0;
      this.emit({ type: "snapshot_lost" });
    });
    source.addEventListener("resync", () => {
      this.emit({ type: "snapshot_lost" });
    });
    source.addEventListener("files", (event) => {
      const data = parse((event as MessageEvent<string>).data);
      const changes = data?.version === 1 ? file_changes(data.changes) : null;
      if (changes) this.emit({ type: "files", changes });
      else this.protocol_error("files");
    });
    source.addEventListener("sync", (event) => {
      const data = parse((event as MessageEvent<string>).data);
      if (data?.version === 1) this.emit({ type: "sync", status: data.status });
      else this.protocol_error("sync");
    });
    source.onerror = () => {
      if (source !== this.source || source.readyState !== EventSource.CLOSED)
        return;
      // EventSource gives up on HTTP errors such as 401 without telling us
      // which one. Ask the session endpoint; a 401 there signs us out.
      this.source = null;
      void this.api
        .get_json("/api/session", 1)
        .then(() => {
          this.schedule_reconnect();
        })
        .catch((error: unknown) => {
          if (is_web_api_error(error, 401)) this.signed_out = true;
          else this.schedule_reconnect();
        });
    };
  }

  private schedule_reconnect(): void {
    if (this.stopped || this.listeners.size === 0) return;
    const delay =
      RECONNECT_DELAYS_MS[
        Math.min(this.failures, RECONNECT_DELAYS_MS.length - 1)
      ];
    this.failures += 1;
    this.reconnect_timer = setTimeout(() => {
      this.reconnect_timer = null;
      this.connect();
    }, delay);
  }
}
