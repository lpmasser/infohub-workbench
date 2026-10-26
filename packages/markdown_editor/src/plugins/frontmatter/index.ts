import type { Input } from "@lezer/common";
import type { BlockContext, MarkdownConfig } from "@lezer/markdown";
import {
  FrontmatterWidget,
  property_rows,
  type FrontmatterOptions,
} from "./widget.js";
export type { FrontmatterOptions, FrontmatterReference } from "./widget.js";
import type { MarkdownPlugin } from "../../core/plugin.js";

// YAML frontmatter: a "---" line at the very top, up to a closing "---" or
// "..." line. Its content stays literal for Markdown commands. An unclosed opening line is ordinary
// Markdown (a rule), so a metadata block being typed does not swallow the
// note below it.
export function frontmatter(options: FrontmatterOptions = {}): MarkdownPlugin {
  return {
    name: "frontmatter",
    syntax: frontmatter_syntax,
    constructs: [
      {
        kind: "block",
        name: "frontmatter",
        nodes: ["Frontmatter"],
        literal: true,
        reveal: "caret",
        complete: (block) => property_rows(block.source, options) !== null,
        widget: (block, state) =>
          new FrontmatterWidget(
            block,
            state.readOnly,
            property_rows(block.source, options) ?? [],
            options,
          ),
      },
      {
        kind: "line",
        name: "frontmatter_source",
        nodes: ["Frontmatter"],
        literal: true,
        decorate(node, render) {
          render.lines(node.from, node.to, "md-frontmatter");
        },
      },
    ],
    theme: {
      ".md-frontmatter-table": {
        width: "100%",
        borderCollapse: "collapse",
        fontSize: "0.85em",
        margin: "0.5em 0 1em",
        tableLayout: "fixed",
      },
      ".md-frontmatter-table th, .md-frontmatter-table td": {
        borderBottom: "1px solid var(--border, #ddd)",
        padding: "0.35em 0.6em",
        textAlign: "left",
        verticalAlign: "top",
        overflowWrap: "anywhere",
      },
      ".md-frontmatter-table th": {
        width: "28%",
        color: "var(--muted-foreground, #666)",
        fontWeight: "normal",
      },
      ".md-frontmatter-value": { whiteSpace: "pre-wrap" },
      ".md-frontmatter-tag": {
        display: "inline-block",
        padding: "0.05em 0.45em",
        margin: "0.1em 0.3em 0.1em 0",
        borderRadius: "0.3em",
        backgroundColor: "var(--muted, #f2f2f2)",
        maxWidth: "100%",
        whiteSpace: "pre-wrap",
      },
      ".md-frontmatter-reference": {
        color: "var(--primary, #285da8)",
        cursor: "pointer",
        font: "inherit",
        textAlign: "left",
        border: "none",
      },
      ".md-frontmatter-reference.md-frontmatter-value": {
        background: "transparent",
        padding: "0",
      },
      ".md-frontmatter-reference:hover": { textDecoration: "underline" },
      ".md-frontmatter": {
        fontFamily: "var(--font-mono, monospace)",
        backgroundColor: "var(--muted, #f2f2f2)",
      },
    },
  };
}

const opening = /^﻿?---[ \t]*$/;
const closing = /^(?:---|\.\.\.)[ \t]*$/;
// A real frontmatter block is small. Bound the lookahead so an unclosed
// opening line at the top of a huge note stays cheap to reparse.
const lookahead_limit = 200_000;

const frontmatter_syntax: MarkdownConfig = {
  defineNodes: [
    { name: "Frontmatter", block: true },
    { name: "FrontmatterMark" },
  ],
  parseBlock: [
    {
      name: "Frontmatter",
      before: "HorizontalRule",
      parse(cx, line) {
        if (cx.lineStart !== 0 || !opening.test(line.text)) return false;
        const end = closing_line_end(cx, line.text.length);
        if (end === null) return false;
        const marks = [cx.elt("FrontmatterMark", 0, line.text.length)];
        while (cx.nextLine()) {
          if (closing.test(line.text)) {
            marks.push(
              cx.elt(
                "FrontmatterMark",
                cx.lineStart,
                cx.lineStart + line.text.length,
              ),
            );
            break;
          }
        }
        cx.nextLine();
        cx.addElement(cx.elt("Frontmatter", 0, end, marks));
        return true;
      },
    },
  ],
};

// @lezer/markdown does not give block parsers its input, and peekLine only
// sees one line ahead. Frontmatter has to find its closing line before it
// claims any line, so read the input the context holds. The frontmatter tests
// cover this if the internal field changes.
function closing_line_end(
  cx: BlockContext,
  first_line_length: number,
): number | null {
  const input = (cx as BlockContext & { input?: Input }).input;
  if (!input) return null;
  const text = input.read(0, Math.min(input.length, lookahead_limit));
  let position = first_line_length + 1;
  while (position <= text.length) {
    const line_end = text.indexOf("\n", position);
    const end = line_end < 0 ? text.length : line_end;
    if (closing.test(text.slice(position, end))) return end;
    if (line_end < 0) return null;
    position = line_end + 1;
  }
  return null;
}
