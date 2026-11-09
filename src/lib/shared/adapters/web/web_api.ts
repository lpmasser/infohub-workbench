// HTTP client for the InfoHub Web API. The contract lives in work-ontology
// server/WEB-API.md; this file only transports it.

export type WebSourceId = string;

export const WORKSPACE_SOURCE: WebSourceId = "workspace";

// Only the user's workspace is writable; main and drafts are read-only.
export function require_workspace(source: WebSourceId): void {
  if (source !== WORKSPACE_SOURCE)
    throw new Error("只读来源不能修改，请切换到我的工作区");
}

export type WebApiErrorDetails = {
  path?: string;
  current_version?: string | null;
};

export class WebApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: WebApiErrorDetails = {},
  ) {
    super(message);
    this.name = status === 404 ? "NotFoundError" : "WebApiError";
  }
}

type Query = Record<string, string | string[] | undefined>;

type RequestOptions = {
  query?: Query;
  headers?: Record<string, string>;
  body?: BodyInit;
};

const BUSY_RETRY_DELAYS_MS = [500, 1000, 2000];

function build_url(path: string, query?: Query): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value])
      params.append(key, item);
  }
  const text = params.toString();
  return text ? `${path}?${text}` : path;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function error_from_response(response: Response): Promise<WebApiError> {
  let code = `HTTP_${String(response.status)}`;
  let message = response.statusText || code;
  const details: WebApiErrorDetails = {};
  try {
    const value: unknown = await response.json();
    const error = record(value) ? value.error : undefined;
    if (record(error)) {
      if (typeof error.code === "string") code = error.code;
      if (typeof error.message === "string") message = error.message;
      if (typeof error.path === "string") details.path = error.path;
      if (
        typeof error.currentVersion === "string" ||
        error.currentVersion === null
      )
        details.current_version = error.currentVersion;
    }
  } catch {
    // Not a JSON error body (proxy failure, HTML). Keep the status.
  }
  return new WebApiError(response.status, code, message, details);
}

export class WebApi {
  private readonly unauthenticated_listeners = new Set<() => void>();

  constructor(
    private readonly fetch_impl: typeof fetch = fetch.bind(globalThis),
  ) {}

  on_unauthenticated(listener: () => void): () => void {
    this.unauthenticated_listeners.add(listener);
    return () => this.unauthenticated_listeners.delete(listener);
  }

  notify_unauthenticated(): void {
    for (const listener of this.unauthenticated_listeners) listener();
  }

  // Resolves with a successful response or rejects with WebApiError. A busy
  // workspace is retried with the same version conditions, never new ones.
  async request(
    method: string,
    path: string,
    options: RequestOptions = {},
  ): Promise<Response> {
    const url = build_url(path, options.query);
    for (let attempt = 0; ; attempt++) {
      const init: RequestInit = {
        method,
        credentials: "same-origin",
        cache: "no-store",
      };
      if (options.headers) init.headers = options.headers;
      if (options.body !== undefined) init.body = options.body;
      const response = await this.fetch_impl(url, init);
      if (response.ok || response.status === 304) return response;
      const error = await error_from_response(response);
      const delay = BUSY_RETRY_DELAYS_MS[attempt];
      if (response.status === 503 && delay !== undefined) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      if (response.status === 401 && path !== "/api/login")
        this.notify_unauthenticated();
      throw error;
    }
  }

  // JSON endpoints carry a protocol version. An unknown version is an error,
  // never an empty result.
  async json<T>(
    method: string,
    path: string,
    expected_version: number,
    options: RequestOptions = {},
  ): Promise<T> {
    const response = await this.request(method, path, options);
    const value: unknown = await response.json();
    if (!record(value) || value.version !== expected_version)
      throw new WebApiError(
        response.status,
        "PROTOCOL_VERSION",
        `InfoHub 服务协议版本不符（${path}），请刷新页面或更新前端`,
      );
    return value as T;
  }

  get_json<T>(path: string, expected_version: number, query?: Query) {
    return this.json<T>("GET", path, expected_version, query ? { query } : {});
  }

  post_json<T>(
    path: string,
    expected_version: number,
    body: unknown,
    options: Omit<RequestOptions, "body"> = {},
  ) {
    return this.json<T>("POST", path, expected_version, {
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
      body: JSON.stringify(body),
    });
  }
}

export function file_url(source: WebSourceId, path: string): string {
  return build_url("/api/file", { source, path });
}

export function is_web_api_error(
  error: unknown,
  status: number,
  code?: string,
): error is WebApiError {
  return (
    error instanceof WebApiError &&
    error.status === status &&
    (code === undefined || error.code === code)
  );
}
