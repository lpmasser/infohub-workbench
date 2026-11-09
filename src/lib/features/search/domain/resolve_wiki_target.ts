// Same rules as the desktop backend's resolve_wiki_target (link_parser.rs):
// "./" and "../" targets are relative to the note's folder, everything else
// to the vault root, and ".md" is implied. Escaping the root yields null.

function resolve_relative_path(
  source_dir: string,
  target: string,
): string | null {
  const segments = source_dir ? source_dir.split("/") : [];
  for (const part of target.split("/")) {
    if (part === "." || part === "") continue;
    if (part === "..") {
      if (segments.pop() === undefined) return null;
      continue;
    }
    segments.push(part);
  }
  const joined = segments.join("/");
  return joined || null;
}

export function resolve_wiki_target(
  source_path: string,
  raw_target: string,
): string | null {
  const base_dir =
    raw_target.startsWith("./") || raw_target.startsWith("../")
      ? source_path.slice(0, Math.max(0, source_path.lastIndexOf("/")))
      : "";
  const cleaned = raw_target.replace(/^\/+/, "");
  if (!cleaned) return null;
  const candidate = cleaned.toLowerCase().endsWith(".md")
    ? cleaned
    : `${cleaned}.md`;
  return resolve_relative_path(base_dir, candidate);
}
