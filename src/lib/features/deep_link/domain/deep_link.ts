// Page addresses that name a document, so a link can be handed around:
//   /o/<ontology_id>#标题     an InfoHub object, optionally at a heading
//   /f/<path>                any file, by its path in the repository
//   ?source=main | draft:<ID> a read-only source instead of the workspace
// Paths and ids are percent-encoded per segment; the hash names a heading.

export const DEFAULT_SOURCE = "workspace";

type Target =
  | { kind: "home" }
  | { kind: "object"; id: string }
  | { kind: "file"; path: string };

export type DeepLink = Target & {
  source: string;
  fragment: string | null;
};

function decode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

export function parse_deep_link(url: URL): DeepLink {
  const source = url.searchParams.get("source") || DEFAULT_SOURCE;
  const fragment = url.hash.length > 1 ? decode(url.hash.slice(1)) : null;
  const base = { source, fragment };
  const object = /^\/o\/([^/]+)\/?$/.exec(url.pathname);
  if (object?.[1]) {
    const id = decode(object[1]);
    if (id) return { ...base, kind: "object", id };
  }
  const file = /^\/f\/(.+?)\/?$/.exec(url.pathname);
  if (file?.[1]) {
    const segments = file[1].split("/").map(decode);
    if (segments.every((segment) => segment))
      return { ...base, kind: "file", path: segments.join("/") };
  }
  return { ...base, kind: "home" };
}

export function format_deep_link(link: DeepLink): string {
  const path =
    link.kind === "object"
      ? `/o/${encodeURIComponent(link.id)}`
      : link.kind === "file"
        ? `/f/${link.path.split("/").map(encodeURIComponent).join("/")}`
        : "/";
  const query =
    link.source === DEFAULT_SOURCE
      ? ""
      : `?source=${encodeURIComponent(link.source)}`;
  const hash = link.fragment ? `#${encodeURIComponent(link.fragment)}` : "";
  return `${path}${query}${hash}`;
}

// The address of a document as the page shows it: an object by its id when
// it has one, any other file by its path.
export function document_link(
  path: string,
  source: string,
  object_id: string | null,
): DeepLink {
  return object_id
    ? { kind: "object", id: object_id, source, fragment: null }
    : { kind: "file", path, source, fragment: null };
}
