// Pure interface state (appearance, layout, selected project) lives in the
// browser. Storage can be missing or throw (private windows, blocked site
// data), so every access degrades to "nothing stored" instead of failing.

const PREFIX = "infohub:";

export function read_browser_value<T>(key: string): T | null {
  try {
    const raw = globalThis.localStorage?.getItem(PREFIX + key);
    return raw == null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}

export function write_browser_value(key: string, value: unknown): void {
  try {
    if (value === undefined || value === null)
      globalThis.localStorage?.removeItem(PREFIX + key);
    else globalThis.localStorage?.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Quota or access errors only cost the remembered layout.
  }
}
