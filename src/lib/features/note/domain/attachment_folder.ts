import { DEFAULT_EDITOR_SETTINGS } from "$lib/shared/types/editor_settings";

export const DEFAULT_ATTACHMENT_FOLDER =
  DEFAULT_EDITOR_SETTINGS.attachment_folder;

// The folder a pasted attachment goes to: the note's own folder, or the
// attachment folder inside it.
export function attachment_target_folder(
  note_path: string,
  options: { store_with_note?: boolean; attachment_folder?: string },
): string {
  const note_dir = note_path.split("/").slice(0, -1);
  if (options.store_with_note) return note_dir.join("/");
  const folder =
    (options.attachment_folder ?? "").trim() || DEFAULT_ATTACHMENT_FOLDER;
  const segments = folder.split("/").filter(Boolean);
  // The server refuses hidden and parent segments, so say why up front.
  if (segments.some((segment) => segment.startsWith(".")))
    throw new Error(
      `附件目录“${folder}”不能以点开头，请在设置里改成如“${DEFAULT_ATTACHMENT_FOLDER}”的目录名`,
    );
  return [...note_dir, ...segments].join("/");
}
