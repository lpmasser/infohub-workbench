import type { ClipboardPort } from "$lib/features/clipboard/ports";

export function create_clipboard_web_adapter(): ClipboardPort {
  return {
    async write_text(text: string) {
      await navigator.clipboard.writeText(text);
    },
  };
}
