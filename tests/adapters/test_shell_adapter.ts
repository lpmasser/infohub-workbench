import type { ShellPort } from "$lib/features/shell";

export function create_test_shell_adapter(): ShellPort & {
  _calls: {
    open_url: string[];
    open_file: string[];
  };
} {
  const calls = {
    open_url: [] as string[],
    open_file: [] as string[],
  };

  return {
    _calls: calls,
    open_url(url) {
      calls.open_url.push(url);
      return Promise.resolve();
    },
    open_file(_vault_id, path) {
      calls.open_file.push(path);
      return Promise.resolve();
    },
  };
}
