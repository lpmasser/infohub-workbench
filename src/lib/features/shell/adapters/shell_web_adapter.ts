import type { ShellPort } from "$lib/features/shell/ports";
import { file_url } from "$lib/shared/adapters/web/web_api";

function open_tab(url: string): Promise<void> {
  window.open(url, "_blank", "noopener,noreferrer");
  return Promise.resolve();
}

export function create_shell_web_adapter(): ShellPort {
  return {
    open_url: open_tab,
    reveal_in_file_manager() {
      return Promise.reject(new Error("网页版没有本机文件管理器"));
    },
    // The browser shows images and PDFs itself and downloads the rest.
    open_in_default_app: (vault_id, path) => open_tab(file_url(vault_id, path)),
  };
}
