import { expect, it } from "vitest";
import { create_notes_web_adapter } from "$lib/features/note/adapters/notes_web_adapter";
import {
  NoteExistsError,
  NoteVersionConflictError,
} from "$lib/features/note/types/note_errors";
import { WebApi } from "$lib/shared/adapters/web/web_api";
import { WebFiles } from "$lib/shared/adapters/web/web_files";
import { as_note_path, as_vault_id } from "$lib/shared/types/ids";

const workspace = as_vault_id("workspace");
const path = as_note_path("docs/a.md");

// A Web API with one file whose bytes and ETag change on every write.
function fake_server(initial: Uint8Array) {
  let bytes = initial;
  let version = 1;
  const puts: Array<{ if_match: string | null; body: Uint8Array }> = [];
  const etag = () => `"sha256-${String(version).padStart(64, "0")}"`;
  const fetch_impl = async (_url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const headers = new Headers(init?.headers);
    if (method === "GET")
      return new Response(bytes.slice(), {
        headers: {
          ETag: etag(),
          "Content-Type": "text/markdown; charset=utf-8",
        },
      });
    if (method === "PUT") {
      const if_match = headers.get("If-Match");
      const body = new Uint8Array(await new Response(init?.body).arrayBuffer());
      puts.push({ if_match, body });
      if (if_match !== etag())
        return Response.json(
          {
            version: 1,
            error: {
              code: "VERSION_CONFLICT",
              message: "x",
              path: "docs/a.md",
            },
          },
          { status: 409 },
        );
      bytes = body;
      version += 1;
      return Response.json({ version: 1, etag: etag(), unchanged: false });
    }
    throw new Error(`unexpected ${method}`);
  };
  const files = new WebFiles(new WebApi(fetch_impl as typeof fetch));
  return {
    adapter: create_notes_web_adapter(files),
    puts,
    change_elsewhere() {
      bytes = new TextEncoder().encode("changed elsewhere\n");
      version += 1;
    },
  };
}

it("writes an unedited note back byte for byte, keeping a byte order mark and CRLF", async () => {
  const original = new Uint8Array([
    0xef,
    0xbb,
    0xbf,
    ...new TextEncoder().encode('---\r\ntitle: "中"\r\n---\r\ncafé\r\n'),
  ]);
  const server = fake_server(original);
  const doc = await server.adapter.read_note(workspace, path);
  await server.adapter.write_note(
    workspace,
    path,
    doc.markdown,
    doc.meta.version,
  );
  expect(server.puts).toHaveLength(1);
  expect([...(server.puts[0]?.body ?? [])]).toEqual([...original]);
  expect(server.puts[0]?.if_match).toBe(`"sha256-${"1".padStart(64, "0")}"`);
});

it("saves only against the version the page loaded and reports a change elsewhere as a conflict", async () => {
  const server = fake_server(new TextEncoder().encode("v1\n"));
  const doc = await server.adapter.read_note(workspace, path);
  server.change_elsewhere();
  await expect(
    server.adapter.write_note(
      workspace,
      path,
      "mine\n" as never,
      doc.meta.version,
    ),
  ).rejects.toBeInstanceOf(NoteVersionConflictError);
  // Without a known base the write may only create; the file exists.
  await expect(
    server.adapter.write_note(workspace, path, "mine\n" as never, null),
  ).rejects.toBeInstanceOf(NoteExistsError);
});

it("refuses to write to a read-only source before any request", async () => {
  const server = fake_server(new TextEncoder().encode("v1\n"));
  await expect(
    server.adapter.write_note(as_vault_id("main"), path, "x" as never, null),
  ).rejects.toThrow("只读来源");
  expect(server.puts).toHaveLength(0);
});
