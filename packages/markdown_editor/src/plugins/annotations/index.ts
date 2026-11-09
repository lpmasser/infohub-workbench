import { syntaxTree } from "@codemirror/language";
import {
  StateField,
  type EditorState,
  type Extension,
} from "@codemirror/state";
import { EditorView, showTooltip, type Tooltip } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import {
  BlockWidget,
  block_for_dom,
  edit_block_source,
  wrap_in_layers,
  type Block,
  type BlockController,
} from "../../core/block_field.js";
import { is_rich } from "../../core/editor_mode.js";
import type { MarkdownPlugin } from "../../core/plugin.js";

// A note left in the source as an HTML comment block of its own. The host
// decides which comments are notes and what they say; this plugin shows them
// as cards, offers a button on a selection to add one, and can remove one.
export type AnnotationNote = {
  date: string;
  author: string;
  text: string;
};

export type AnnotationOptions = {
  parse: (source: string) => AnnotationNote | null;
  // A remove button is shown only where this says yes.
  can_remove?: (note: AnnotationNote) => boolean;
  // The selection button. Without it there is no button.
  on_request?: () => void;
  label?: string;
};

export function annotations(options: AnnotationOptions): MarkdownPlugin {
  return {
    name: "annotations",
    constructs: [
      {
        kind: "block",
        name: "annotation",
        nodes: ["CommentBlock"],
        literal: true,
        reveal: "caret",
        complete: (block) => options.parse(block.source.trim()) !== null,
        widget: (block, state) =>
          new AnnotationWidget(
            block,
            state.readOnly,
            options.parse(block.source.trim()) ?? {
              date: "",
              author: "",
              text: "",
            },
            options,
          ),
      },
    ],
    extensions: options.on_request ? selection_button(options) : [],
    theme: {
      ".md-annotation": {
        display: "flex",
        gap: "0.5em",
        alignItems: "flex-start",
        margin: "0.4em 0",
        padding: "0.45em 0.7em",
        borderLeft: "3px solid var(--warning-border, #d97706)",
        borderRadius: "0.3em",
        backgroundColor: "var(--warning-bg, #fff7e6)",
        color: "var(--warning-text-on-bg, inherit)",
        fontSize: "0.9em",
        cursor: "text",
      },
      ".md-annotation-body": { flex: "1", minWidth: "0" },
      ".md-annotation-meta": {
        fontSize: "0.85em",
        opacity: "0.75",
        marginBottom: "0.15em",
      },
      ".md-annotation-text": {
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
      },
      ".md-annotation-remove": {
        flex: "none",
        border: "none",
        background: "transparent",
        color: "inherit",
        opacity: "0.7",
        cursor: "pointer",
        font: "inherit",
        fontSize: "0.85em",
        textDecoration: "underline",
      },
      ".md-annotation-remove:hover": { opacity: "1" },
      ".cm-tooltip.md-annotation-button": {
        border: "1px solid var(--border, #ddd)",
        borderRadius: "0.3em",
        backgroundColor: "var(--popover, #fff)",
      },
      ".md-annotation-button button": {
        padding: "0.2em 0.7em",
        font: "inherit",
        fontSize: "0.85em",
        cursor: "pointer",
        border: "none",
        background: "transparent",
        color: "var(--popover-foreground, inherit)",
      },
    },
  };
}

class AnnotationWidget extends BlockWidget {
  constructor(
    block: Block,
    read_only: boolean,
    readonly note: AnnotationNote,
    readonly options: AnnotationOptions,
  ) {
    super(block, read_only);
  }
  protected estimate_height(): number {
    return 56;
  }
  protected create_controller(view: EditorView): BlockController {
    return new AnnotationController(view, this);
  }
}

class AnnotationController implements BlockController {
  readonly root: HTMLElement;
  constructor(
    readonly view: EditorView,
    private readonly widget: AnnotationWidget,
  ) {
    const { note, options } = widget;
    const card = document.createElement("div");
    card.className = "md-annotation";
    card.setAttribute("role", "note");
    const body = document.createElement("div");
    body.className = "md-annotation-body";
    const meta = document.createElement("div");
    meta.className = "md-annotation-meta";
    meta.textContent = `${options.label ?? "Note"} · ${note.date} · ${note.author}`;
    const text = document.createElement("div");
    text.className = "md-annotation-text";
    text.textContent = note.text;
    body.append(meta, text);
    card.append(body);
    card.onclick = () => this.edit();
    if (!widget.read_only && options.can_remove?.(note)) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "md-annotation-remove";
      remove.textContent = "删除";
      remove.setAttribute("aria-label", "删除这条批注");
      remove.onclick = (event) => {
        event.stopPropagation();
        this.remove();
      };
      card.append(remove);
    }
    this.root = wrap_in_layers(widget.block, card);
    this.root.dataset.mdBlock = "annotation";
  }
  private edit(): boolean {
    const block = block_for_dom(this.view, this.root);
    if (!block) return false;
    this.view.dispatch({
      effects: edit_block_source.of(block.from),
      selection: { anchor: block.from },
    });
    this.view.focus();
    return true;
  }
  // Removes the comment's lines and one line break, nothing else.
  private remove(): boolean {
    const block = block_for_dom(this.view, this.root);
    if (!block || this.view.state.readOnly) return false;
    const { doc } = this.view.state;
    const range =
      block.to < doc.length
        ? { from: block.from, to: block.to + 1 }
        : { from: Math.max(0, block.from - 1), to: block.to };
    this.view.dispatch({
      changes: range,
      userEvent: "delete",
    });
    return true;
  }
  enter(side: -1 | 1): boolean {
    void side;
    return this.edit();
  }
  update(widget: BlockWidget): boolean {
    return this.widget.eq(widget);
  }
  destroy(): void {}
}

// The top-level block that holds a position: a paragraph, a whole list or
// table, a quote, a heading.
function top_level_block(
  state: EditorState,
  position: number,
): SyntaxNode | null {
  let node: SyntaxNode | null = syntaxTree(state).resolveInner(position, -1);
  while (node?.parent && node.parent.name !== "Document") node = node.parent;
  return node && node.name !== "Document" ? node : null;
}

// Puts `text` on new lines right after the block that holds the end of the
// selection. Returns false when nothing was inserted.
export function insert_after_selected_block(
  view: EditorView,
  text: string,
): boolean {
  const { state } = view;
  if (state.readOnly) return false;
  const position = state.selection.main.to;
  const block = top_level_block(state, position);
  const end = block ? block.to : position;
  const line = state.doc.lineAt(
    end > 0 && state.doc.sliceString(end - 1, end) === "\n" ? end - 1 : end,
  );
  view.dispatch({
    changes: { from: line.to, insert: `\n${text}` },
    userEvent: "input",
    scrollIntoView: true,
  });
  return true;
}

function selection_button(options: AnnotationOptions): Extension {
  const field = StateField.define<Tooltip | null>({
    create: (state) => button_tooltip(state, options),
    update(value, transaction) {
      if (!transaction.selection && !transaction.docChanged) return value;
      return button_tooltip(transaction.state, options);
    },
    provide: (field) => showTooltip.from(field),
  });
  return field;
}

function button_tooltip(
  state: EditorState,
  options: AnnotationOptions,
): Tooltip | null {
  const range = state.selection.main;
  if (range.empty || state.readOnly || !is_rich(state)) return null;
  return {
    pos: range.head,
    above: range.head <= range.anchor,
    arrow: false,
    create() {
      const dom = document.createElement("div");
      dom.className = "md-annotation-button";
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = options.label ?? "Note";
      // Keep the editor selection: the host inserts after its block.
      button.onmousedown = (event) => {
        event.preventDefault();
      };
      button.onclick = () => options.on_request?.();
      dom.append(button);
      return { dom };
    },
  };
}
