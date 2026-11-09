import { expect, it } from "vitest";
import { attachment_target_folder } from "$lib/features/note/domain/attachment_folder";
import { DEFAULT_EDITOR_SETTINGS } from "$lib/shared/types/editor_settings";

it("puts pasted attachments in 附件 beside the note by default, never at the root", () => {
  const defaults = {
    attachment_folder: DEFAULT_EDITOR_SETTINGS.attachment_folder,
  };
  expect(attachment_target_folder("ontomato/记录/产品会.md", defaults)).toBe(
    "ontomato/记录/附件",
  );
  expect(attachment_target_folder("首页.md", defaults)).toBe("附件");
  expect(
    attachment_target_folder("ontomato/记录/产品会.md", {
      attachment_folder: "",
    }),
  ).toBe("ontomato/记录/附件");
});

it("uses the configured folder inside the note's folder, or the note's own folder", () => {
  expect(
    attachment_target_folder("a/b.md", { attachment_folder: "图片" }),
  ).toBe("a/图片");
  expect(attachment_target_folder("a/b.md", { store_with_note: true })).toBe(
    "a",
  );
});

it("refuses a dot-prefixed folder such as the old .assets setting", () => {
  expect(() =>
    attachment_target_folder("a/b.md", { attachment_folder: ".assets" }),
  ).toThrow("不能以点开头");
});
