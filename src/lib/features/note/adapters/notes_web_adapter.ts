import type { NotesPort } from "$lib/features/note/ports";
import {
  NoteExistsError,
  NoteNotTextError,
  NoteVersionConflictError,
} from "$lib/features/note/types/note_errors";
import {
  WebApiError,
  is_web_api_error,
  require_workspace,
} from "$lib/shared/adapters/web/web_api";
import type { WebFiles, WebTree } from "$lib/shared/adapters/web/web_files";
import { as_markdown_text } from "$lib/shared/types/ids";
import { note_meta } from "$lib/shared/utils/note_meta";
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

function is_markdown(path: string): boolean {
  return path.toLowerCase().endsWith(".md");
}

function parent(path: string): string {
  const index = path.lastIndexOf("/");
  return index < 0 ? "" : path.slice(0, index);
}

function compare_names(a: string, b: string): number {
  const left = a.toLowerCase();
  const right = b.toLowerCase();
  return left < right ? -1 : left > right ? 1 : a < b ? -1 : a > b ? 1 : 0;
}

function children(tree: WebTree, folder: string) {
  const by_name = (a: string, b: string) => compare_names(leaf(a), leaf(b));
  return {
    subfolders: [...tree.directories]
      .filter((path) => parent(path) === folder)
      .sort(by_name),
    files: [...tree.files.keys()]
      .filter((path) => parent(path) === folder)
      .sort(by_name),
  };
}

function in_folder(path: string, folder: string): boolean {
  return folder === "" || path.startsWith(`${folder}/`);
}

function not_found(path: string): WebApiError {
  return new WebApiError(404, "FILE_NOT_FOUND", `not found: ${path}`);
}

export function create_notes_web_adapter(files: WebFiles): NotesPort {
  async function existing_version(path: string): Promise<string> {
    const version = await files.current_version(path);
    if (!version) throw not_found(path);
    return version;
  }

  async function write(
    path: string,
    markdown: string,
    base_version: string | null,
  ): Promise<string> {
    try {
      return await files.write(
        path,
        encoder.encode(markdown),
        base_version === null ? { create: true } : { if_match: base_version },
      );
    } catch (error) {
      if (!is_web_api_error(error, 409)) throw error;
      throw base_version === null
        ? new NoteExistsError(path)
        : new NoteVersionConflictError(path);
    }
  }

  // Moves and deletes act on the file as it is now: the user picked it in
  // the tree, where no content was shown. The version still makes the
  // server refuse if it changes between this read and the request.
  async function move(from: string, to: string, overwrite: boolean) {
    const version = await existing_version(from);
    const destination_version = overwrite
      ? await files.current_version(to)
      : null;
    try {
      await files.move(from, to, version, destination_version);
    } catch (error) {
      if (!is_web_api_error(error, 409)) throw error;
      throw error.details.path === to
        ? new NoteExistsError(to)
        : new NoteVersionConflictError(from);
    }
  }

  return {
    async list_notes(vault_id) {
      const tree = await files.tree(vault_id);
      return [...tree.files]
        .filter(([path]) => is_markdown(path))
        .map(([path, size]) => note_meta(path, size));
    },

    async list_folders(vault_id) {
      return [...(await files.tree(vault_id)).directories];
    },

    async read_note(vault_id, note_id) {
      const file = await files.read(vault_id, note_id);
      if (/^(image|audio|video)\/|^application\/pdf/.test(file.content_type))
        throw new NoteNotTextError(note_id);
      let markdown: string;
      try {
        markdown = decoder.decode(file.bytes);
      } catch {
        throw new NoteNotTextError(note_id);
      }
      return {
        meta: note_meta(note_id, file.bytes.length, file.etag),
        markdown: as_markdown_text(markdown),
      };
    },

    async read_note_meta(vault_id, note_id) {
      const size = (await files.tree(vault_id)).files.get(note_id);
      if (size === undefined) throw not_found(note_id);
      return note_meta(note_id, size);
    },

    async write_note(vault_id, note_id, markdown, base_version) {
      require_workspace(vault_id);
      return await write(note_id, markdown, base_version);
    },

    async current_version(vault_id, note_id) {
      require_workspace(vault_id);
      return await files.current_version(note_id);
    },

    async create_note(vault_id, note_path, initial_markdown) {
      require_workspace(vault_id);
      const version = await write(note_path, initial_markdown, null);
      return note_meta(
        note_path,
        encoder.encode(initial_markdown).length,
        version,
      );
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
        if (is_web_api_error(error, 409))
          throw new NoteVersionConflictError(note_id);
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
        throw not_found(folder_path);
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
            note_meta(entry.path, tree.files.get(entry.path) ?? 0),
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
            error: "不能移动文件夹，请逐个移动文件",
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
  };
}
