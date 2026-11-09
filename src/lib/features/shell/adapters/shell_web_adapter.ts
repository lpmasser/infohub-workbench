import type { ShellPort } from "$lib/features/shell/ports";
import { file_url } from "$lib/shared/adapters/web/web_api";

function open_tab(url: string): Promise<void> {
  window.open(url, "_blank", "noopener,noreferrer");
  return Promise.resolve();
}

export function create_shell_web_adapter(): ShellPort {
  return {
    open_url: open_tab,
    // The browser shows images and PDFs itself and downloads the rest.
    open_file: (vault_id, path) => open_tab(file_url(vault_id, path)),
  };
}
