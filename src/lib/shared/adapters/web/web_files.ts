import {
  WebApi,
  WORKSPACE_SOURCE,
  file_url,
  is_web_api_error,
  type WebSourceId,
} from "$lib/shared/adapters/web/web_api";

export type WebTree = {
  // File path -> size in bytes.
  files: Map<string, number>;
  directories: Set<string>;
  commit: string | null;
};

export type WebFileRead = {
  bytes: Uint8Array;
  etag: string;
  content_type: string;
};

export type WebFileChange = { path: string; version: string | null };

export type ClassifiedChange = {
  path: string;
  kind: "added" | "changed" | "removed";
};

type TreeResponse = {
  version: 1;
  commit: string | null;
  entries: Array<{ path: string; type: string; size?: number }>;
};

type WriteResponse = { version: 1; etag: string; unchanged?: boolean };
type MoveResponse = { version: 1; path: string; etag: string };

function validate_tree(value: TreeResponse): WebTree {
  if (!Array.isArray(value.entries))
    throw new Error("InfoHub 目录树响应无效，请刷新页面或更新前端");
  const files = new Map<string, number>();
  const directories = new Set<string>();
  for (const entry of value.entries) {
    if (entry.type === "directory") directories.add(entry.path);
    else if (entry.type === "file") files.set(entry.path, entry.size ?? 0);
    else throw new Error("InfoHub 目录树响应无效，请刷新页面或更新前端");
  }
  return { files, directories, commit: value.commit };
}

// Files of every source, with each source's tree cached until a change.
export class WebFiles {
  private readonly trees = new Map<WebSourceId, Promise<WebTree>>();

  constructor(readonly api: WebApi) {}

  tree(source: WebSourceId): Promise<WebTree> {
    let tree = this.trees.get(source);
    if (!tree) {
      const pending = this.api
        .get_json<TreeResponse>("/api/tree", 1, { source })
        .then(validate_tree);
      tree = pending;
      this.trees.set(source, pending);
      pending.catch(() => {
        if (this.trees.get(source) === pending) this.trees.delete(source);
      });
    }
    return tree;
  }

  invalidate_tree(source?: WebSourceId): void {
    if (source === undefined) this.trees.clear();
    else this.trees.delete(source);
  }

  // Classifies workspace change events against the tree the client last saw,
  // then drops that tree so the next reader fetches the final state.
  async classify_workspace_changes(
    changes: WebFileChange[],
  ): Promise<ClassifiedChange[]> {
    const tree = this.trees.get(WORKSPACE_SOURCE);
    const known = tree ? await tree.catch(() => null) : null;
    this.invalidate_tree(WORKSPACE_SOURCE);
    return changes.map((change) => ({
      path: change.path,
      kind:
        change.version === null
          ? "removed"
          : known && !known.files.has(change.path)
            ? "added"
            : "changed",
    }));
  }

  async read(source: WebSourceId, path: string): Promise<WebFileRead> {
    const response = await this.api.request("GET", file_url(source, path));
    const etag = response.headers.get("ETag");
    if (!etag) throw new Error("InfoHub 文件响应缺少版本");
    return {
      bytes: new Uint8Array(await response.arrayBuffer()),
      etag,
      content_type: response.headers.get("Content-Type") ?? "",
    };
  }

  // The current ETag, or null when the file does not exist.
  async current_version(path: string): Promise<string | null> {
    try {
      return (await this.read(WORKSPACE_SOURCE, path)).etag;
    } catch (error) {
      if (is_web_api_error(error, 404)) return null;
      throw error;
    }
  }

  async write(
    path: string,
    bytes: Uint8Array,
    condition: { if_match: string } | { create: true },
  ): Promise<string> {
    const response = await this.api.json<WriteResponse>(
      "PUT",
      file_url(WORKSPACE_SOURCE, path),
      1,
      {
        headers:
          "create" in condition
            ? { "If-None-Match": "*" }
            : { "If-Match": condition.if_match },
        body: bytes as Uint8Array<ArrayBuffer>,
      },
    );
    this.invalidate_tree(WORKSPACE_SOURCE);
    return response.etag;
  }

  async remove(path: string, if_match: string): Promise<void> {
    await this.api.json("DELETE", file_url(WORKSPACE_SOURCE, path), 1, {
      headers: { "If-Match": if_match },
    });
    this.invalidate_tree(WORKSPACE_SOURCE);
  }

  async move(
    path: string,
    destination: string,
    if_match: string,
    destination_version: string | null,
  ): Promise<string> {
    const response = await this.api.post_json<MoveResponse>(
      "/api/move",
      1,
      { path, destination, destinationVersion: destination_version },
      {
        query: { source: WORKSPACE_SOURCE },
        headers: { "If-Match": if_match },
      },
    );
    this.invalidate_tree(WORKSPACE_SOURCE);
    return response.etag;
  }
}
