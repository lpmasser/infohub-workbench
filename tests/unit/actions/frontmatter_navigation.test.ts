/** @vitest-environment jsdom */
import { expect, it, vi } from "vitest";
import { create_app_context } from "$lib/app/di/create_app_context";
import { create_test_ports } from "../../adapters/test_ports";
import {
  create_open_note_state,
  create_test_note,
  create_test_vault,
} from "../helpers/test_fixtures";
import { infohub_overview } from "../helpers/infohub_fixtures";
import type { ReactorContext } from "$lib/reactors";
import { as_markdown_text, as_note_path } from "$lib/shared/types/ids";

const { reactors } = vi.hoisted(() => ({ reactors: vi.fn() }));
vi.mock("$lib/reactors", () => ({ mount_reactors: reactors }));
vi.mock("$lib/app/orchestration/app_exit", () => ({
  install_app_exit: () => () => {},
}));

it("a property reference reaches the real note-open action with its exact mapped path", async () => {
  reactors.mockReturnValue(() => {});
  const ports = create_test_ports();
  const app = create_app_context({
    ports,
    default_mount_config: {
      reset_app_state: false,
      bootstrap_default_vault_path: null,
    },
  });
  const context = reactors.mock.calls[0]?.[0] as ReactorContext;
  const vault = create_test_vault();
  const path = as_note_path("目录/中文 空格#100%.md");
  const reference = { title: "目标标题", path };
  const read = vi.spyOn(ports.notes, "read_note").mockResolvedValue({
    meta: { ...create_test_note(path, reference.title), id: path, path },
    markdown: as_markdown_text("# 目标标题"),
  });
  app.stores.vault.set_vault(vault);
  app.stores.infohub.overview = {
    ...infohub_overview("工作"),
    references: { "project-1": reference },
  };
  const root = document.createElement("div");
  document.body.append(root);
  try {
    await context.editor_service.mount({
      root,
      note: create_open_note_state(
        create_test_note("source", "Source"),
        "---\nontology_id: project-1\nproject_id: project-1\nunknown: constructor\n---\nbody",
      ),
    });
    const button = root.querySelector<HTMLButtonElement>(
      ".md-frontmatter-reference",
    );
    expect(button?.textContent).toBe(reference.title);
    expect(root.querySelector(".md-frontmatter-value")?.textContent).toBe(
      "project-1",
    );
    expect(root.querySelectorAll(".md-frontmatter-reference")).toHaveLength(1);
    button?.click();
    await vi.waitFor(() => {
      expect(read).toHaveBeenCalledWith(vault.id, path);
    });
    expect(app.stores.tab.active_tab?.note_path).toBe(path);
  } finally {
    app.destroy();
    root.remove();
  }
});
