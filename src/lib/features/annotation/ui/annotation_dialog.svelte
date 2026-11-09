<script lang="ts">
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import { Button } from "$lib/components/ui/button";

  interface Props {
    open: boolean;
    text: string;
    error: string | null;
    on_update: (text: string) => void;
    on_confirm: () => void;
    on_cancel: () => void;
  }

  let { open, text, error, on_update, on_confirm, on_cancel }: Props = $props();
</script>

<Dialog.Root
  {open}
  onOpenChange={(value: boolean) => {
    if (!value) on_cancel();
  }}
>
  <Dialog.Content class="max-w-md">
    <Dialog.Header>
      <Dialog.Title>批注</Dialog.Title>
      <Dialog.Description>
        写给 Agent 的话，插在选中内容所在段落之后，保存进文档。
      </Dialog.Description>
    </Dialog.Header>
    <form
      class="flex flex-col gap-2"
      onsubmit={(event) => {
        event.preventDefault();
        on_confirm();
      }}
    >
      <textarea
        class="min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
        value={text}
        oninput={(event) => on_update(event.currentTarget.value)}
        onkeydown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            on_confirm();
          }
        }}
        aria-label="批注内容"
        placeholder="例如：时间不对，应该是 11-06"
      ></textarea>
      {#if error}<p class="text-sm text-destructive" role="alert">
          {error}
        </p>{/if}
      <Dialog.Footer>
        <Button type="button" variant="outline" onclick={on_cancel}>取消</Button
        >
        <Button type="submit">添加批注</Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>
