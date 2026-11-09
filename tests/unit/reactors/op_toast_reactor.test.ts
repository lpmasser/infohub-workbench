import { describe, expect, it } from "vitest";
import { resolve_op_toast_commands } from "$lib/reactors/op_toast.reactor.svelte";

describe("op_toast.reactor", () => {
  it("returns clipboard success toast when operation transitions to success", () => {
    const commands = resolve_op_toast_commands({
      key: "clipboard.write",
      previous_status: "pending",
      current_status: "success",
      error: null,
    });

    expect(commands).toEqual([
      { kind: "success", message: "Copied to clipboard" },
    ]);
  });

  it("returns no commands when status is unchanged", () => {
    const commands = resolve_op_toast_commands({
      key: "clipboard.write",
      previous_status: "pending",
      current_status: "pending",
      error: null,
    });

    expect(commands).toEqual([]);
  });
});
