import type { NotesPort } from "$lib/features/note/ports";
import {
  WebApiError,
  WORKSPACE_SOURCE,
} from "$lib/shared/adapters/web/web_api";
import type { WebFiles, WebTree } from "$lib/shared/adapters/web/web_files";
import {
  as_markdown_text,
  as_note_path,
  type VaultId,
} from "$lib/shared/types/ids";
import type { NoteMeta } from "$lib/shared/types/note";
import type {
  FolderContents,
  MoveItemResult,
} from "$lib/shared/types/filetree";

// ignoreBOM keeps a byte order mark in the text, so writing the text back
// yields the bytes that were read.
const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
const encoder = new TextEncoder();

function leaf(path: string): string {
  return path.split("/").at(-1) ?? path;
}

function note_name(path: string): string {
  return leaf(path).replace(/\.md$/, "");
}

function is_markdown(path: string): boolean {
  return path.toLowerCase().endsWith(".md");
}

function parent(path: string): string {
  const index = path.lastIndexOf("/");
  return index < 0 ? "" : path.slice(0, index);
}

function to_meta(path: string, size_bytes: number, mtime_ms: number): NoteMeta {
  const id = as_note_path(path);
  // Titles would need every file's content; the tree shows file names.
  return {
    id,
    path: id,
    name: note_name(path),
    title: note_name(path),
    mtime_ms,
    size_bytes,
  };
}

function compare_names(a: string, b: string): number {
  const left = a.toLowerCase();
  const right = b.toLowerCase();
  return left < right ? -1 : left > right ? 1 : a < b ? -1 : a > b ? 1 : 0;
}

function children(tree: WebTree, folder: string) {
  const subfolders = [...tree.directories]
    .filter((path) => parent(path) === folder)
    .sort((a, b) => compare_names(leaf(a), leaf(b)));
  const files = [...tree.files.keys()]
    .filter((path) => parent(path) === folder)
    .sort((a, b) => compare_names(leaf(a), leaf(b)));
  return { subfolders, files };
}

function in_folder(path: string, folder: string): boolean {
  return folder === "" || path.startsWith(`${folder}/`);
}

function unsupported(what: string): Promise<never> {
  return Promise.reject(new Error(`网页版不支持${what}`));
}

// The services recognize these conditions by message, as with the desktop
// backend's errors.
function conflict_error(path: string): Error {
  return new Error(`conflict:mtime_mismatch: ${path} 已在别处修改，未覆盖`);
}

function exists_error(path: string): Error {
  return new Error(`note already exists: ${path}`);
}

function require_workspace(vault_id: VaultId): void {
  if (vault_id !== WORKSPACE_SOURCE)
    throw new Error("只读来源不能修改，请切换到我的工作区");
}

function is_conflict(error: unknown): error is WebApiError {
  return error instanceof WebApiError && error.status === 409;
}

export function create_notes_web_adapter(files: WebFiles): NotesPort {
  async function tree_meta(vault_id: VaultId, path: string): Promise<NoteMeta> {
    const tree = await files.tree(vault_id);
    const size = tree.files.get(path);
    if (size === undefined)
      throw new WebApiError(404, "FILE_NOT_FOUND", `not found: ${path}`);
    const etag = files.latest_etag(vault_id, path);
    return to_meta(
      path,
      size,
      etag ? files.version_token(vault_id, path, etag) : 0,
    );
  }

  // The version a write must match. Token 0 is the user's explicit "keep my
  // changes"; any other token must be a version this page has loaded.
  async function expected_version(
    path: string,
    token: number | undefined,
  ): Promise<string | null> {
    if (token === 0) return await files.current_version(path);
    if (token === undefined)
      return (
        files.latest_etag(WORKSPACE_SOURCE, path) ??
        (await files.current_version(path))
      );
    const etag = files.version_etag(WORKSPACE_SOURCE, path, token);
    if (!etag) throw conflict_error(path);
    return etag;
  }

  async function existing_version(path: string): Promise<string> {
    const etag =
      files.latest_etag(WORKSPACE_SOURCE, path) ??
      (await files.current_version(path));
    if (!etag)
      throw new WebApiError(404, "FILE_NOT_FOUND", `not found: ${path}`);
    return etag;
  }

  async function write_text(
    path: string,
    markdown: string,
    etag: string | null,
  ): Promise<number> {
    try {
      const saved = await files.write(
        path,
        encoder.encode(markdown),
        etag === null ? { create: true } : { if_match: etag },
      );
      return files.version_token(WORKSPACE_SOURCE, path, saved);
    } catch (error) {
      if (is_conflict(error))
        throw etag === null ? exists_error(path) : conflict_error(path);
      throw error;
    }
  }

  async function move(
    from: string,
    to: string,
    overwrite: boolean,
  ): Promise<void> {
    const etag = await existing_version(from);
    const destination_version = overwrite
      ? await files.current_version(to)
      : null;
    try {
      const moved = await files.move(from, to, etag, destination_version);
      files.version_token(WORKSPACE_SOURCE, to, moved);
    } catch (error) {
      if (!is_conflict(error)) throw error;
      throw error.details.path === to ? exists_error(to) : conflict_error(from);
    }
  }

  return {
    async list_notes(vault_id) {
      const tree = await files.tree(vault_id);
      return [...tree.files]
        .filter(([path]) => is_markdown(path))
        .map(([path, size]) => to_meta(path, size, 0));
    },

    async list_folders(vault_id) {
      return [...(await files.tree(vault_id)).directories];
    },

    async read_note(vault_id, note_id) {
      const file = await files.read(vault_id, note_id);
      if (/^(image|audio|video)\/|^application\/pdf/.test(file.content_type))
        throw new Error(`file_not_text: ${note_id}`);
      let markdown: string;
      try {
        markdown = decoder.decode(file.bytes);
      } catch {
        throw new Error(`file_not_text: ${note_id}`);
      }
      const token = files.version_token(vault_id, note_id, file.etag);
      return {
        meta: to_meta(note_id, file.bytes.length, token),
        markdown: as_markdown_text(markdown),
      };
    },

    read_note_meta: tree_meta,

    async write_note(vault_id, note_id, markdown, expected_mtime_ms) {
      require_workspace(vault_id);
      const etag = await expected_version(note_id, expected_mtime_ms);
      return await write_text(note_id, markdown, etag);
    },

    async create_note(vault_id, note_path, initial_markdown) {
      require_workspace(vault_id);
      const token = await write_text(note_path, initial_markdown, null);
      return to_meta(note_path, encoder.encode(initial_markdown).length, token);
    },

    async rename_note(vault_id, from, to) {
      require_workspace(vault_id);
      await move(from, to, false);
    },

    async delete_note(vault_id, note_id) {
      require_workspace(vault_id);
      try {
        await files.remove(note_id, await existing_version(note_id));
      } catch (error) {
        if (is_conflict(error)) throw conflict_error(note_id);
        throw error;
      }
    },

    async list_folder_contents(
      vault_id,
      folder_path,
      offset,
      limit,
    ): Promise<FolderContents> {
      const tree = await files.tree(vault_id);
      if (folder_path && !tree.directories.has(folder_path))
        throw new WebApiError(
          404,
          "FILE_NOT_FOUND",
          `not found: ${folder_path}`,
        );
      const { subfolders, files: file_paths } = children(tree, folder_path);
      const entries = [
        ...subfolders.map((path) => ({ path, folder: true })),
        ...file_paths.map((path) => ({ path, folder: false })),
      ];
      const page = entries.slice(offset, offset + limit);
      return {
        subfolders: page.filter((entry) => entry.folder).map((e) => e.path),
        notes: page
          .filter((entry) => !entry.folder)
          .map((entry) =>
            to_meta(entry.path, tree.files.get(entry.path) ?? 0, 0),
          ),
        total_count: entries.length,
        has_more: offset + limit < entries.length,
      };
    },

    async get_folder_stats(vault_id, folder_path) {
      const tree = await files.tree(vault_id);
      return {
        note_count: [...tree.files.keys()].filter(
          (path) => is_markdown(path) && in_folder(path, folder_path),
        ).length,
        folder_count: [...tree.directories].filter(
          (path) => path !== folder_path && in_folder(path, folder_path),
        ).length,
      };
    },

    async move_items(vault_id, items, target_folder, overwrite) {
      require_workspace(vault_id);
      const results: MoveItemResult[] = [];
      for (const item of items) {
        const new_path = target_folder
          ? `${target_folder}/${leaf(item.path)}`
          : leaf(item.path);
        if (item.is_folder) {
          results.push({
            path: item.path,
            new_path,
            success: false,
            error: "网页版不能移动文件夹，请逐个移动文件",
          });
          continue;
        }
        try {
          await move(item.path, new_path, overwrite);
          results.push({
            path: item.path,
            new_path,
            success: true,
            error: null,
          });
        } catch (error) {
          results.push({
            path: item.path,
            new_path,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
      return results;
    },

    create_folder: () => unsupported("新建空文件夹"),
    rename_folder: () => unsupported("重命名文件夹"),
    delete_folder: () => unsupported("删除文件夹"),
    apply_markdown_cleanup: () => unsupported("旧格式 Markdown 清理"),
    get_latest_markdown_cleanup_backup: () => Promise.resolve(null),
    restore_latest_markdown_cleanup: () => Promise.resolve(null),
  };
}
