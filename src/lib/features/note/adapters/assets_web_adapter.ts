import type { AssetsPort } from "$lib/features/note/ports";
import { NoteExistsError } from "$lib/features/note/types/note_errors";
import {
  file_url,
  is_web_api_error,
  require_workspace,
} from "$lib/shared/adapters/web/web_api";
import type { WebFiles } from "$lib/shared/adapters/web/web_files";
import { as_asset_path } from "$lib/shared/types/ids";

const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/bmp": "bmp",
  "image/svg+xml": "svg",
};

function extension(mime_type: string, file_name: string | null): string {
  const from_name = file_name?.match(/\.([^./]+)$/)?.[1]?.toLowerCase();
  return from_name || MIME_EXTENSIONS[mime_type.toLowerCase()] || "png";
}

function sanitize_stem(value: string): string {
  const stem = value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return stem || "image";
}

function stem(path: string): string {
  return (path.split("/").at(-1) ?? path).replace(/\.[^.]*$/, "");
}

export function create_assets_web_adapter(files: WebFiles): AssetsPort {
  return {
    // Same-origin URL; the session cookie authorizes the image request.
    resolve_asset_url(vault_id, asset_path) {
      return file_url(vault_id, asset_path);
    },

    // Pasted images go next to the note or into the attachment folder at
    // the root, named after the pasted file or the note.
    async write_image_asset(vault_id, input) {
      require_workspace(vault_id);
      const { image } = input;
      const ext = extension(image.mime_type, image.file_name);
      const custom = input.custom_filename
        ?.replace(/[/\\]/g, "")
        .replace(/^\.+/, "");
      if (input.custom_filename !== undefined && !custom)
        throw new Error("文件名无效");
      const filename = custom
        ? /\.[^.]+$/.test(custom)
          ? custom
          : `${custom}.${ext}`
        : `${sanitize_stem(image.file_name ? stem(image.file_name) : stem(input.note_path))}-${String(Date.now())}.${ext}`;
      const folder = input.store_with_note
        ? input.note_path.split("/").slice(0, -1).join("/")
        : (input.attachment_folder ?? "assets");
      if (folder.split("/").some((segment) => segment.startsWith(".")))
        throw new Error(
          `附件目录“${folder}”以点开头，服务器不允许；请在设置里换一个目录名或改为与笔记同目录`,
        );
      const path = folder ? `${folder}/${filename}` : filename;
      try {
        await files.write(path, image.bytes, { create: true });
      } catch (error) {
        if (is_web_api_error(error, 409)) throw new NoteExistsError(path);
        throw error;
      }
      return as_asset_path(path);
    },
  };
}
