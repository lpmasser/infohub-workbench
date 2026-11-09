<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";

  type Props = {
    title: string;
    message?: string | null;
    on_submit: (username: string, password: string) => Promise<void>;
  };

  let { title, message = null, on_submit }: Props = $props();

  let username = $state("");
  let password = $state("");
  let pending = $state(false);
  let error = $state<string | null>(null);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (pending) return;
    pending = true;
    error = null;
    try {
      await on_submit(username.trim(), password);
      password = "";
    } catch (failure) {
      error = failure instanceof Error ? failure.message : String(failure);
    } finally {
      pending = false;
    }
  }
</script>

<form class="LoginForm" onsubmit={submit} aria-label="登录 InfoHub">
  <h1 class="LoginForm__title">{title}</h1>
  {#if message}<p class="LoginForm__message">{message}</p>{/if}
  <label class="LoginForm__field">
    <span>用户名</span>
    <Input
      bind:value={username}
      name="username"
      autocomplete="username"
      autocapitalize="off"
      spellcheck={false}
      required
    />
  </label>
  <label class="LoginForm__field">
    <span>密码</span>
    <Input
      bind:value={password}
      name="password"
      type="password"
      autocomplete="current-password"
      required
    />
  </label>
  {#if error}<p class="LoginForm__error" role="alert">{error}</p>{/if}
  <Button type="submit" disabled={pending || !username || !password}>
    {pending ? "正在登录…" : "登录"}
  </Button>
</form>

<style>
  .LoginForm {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    width: min(100%, 22rem);
    padding: var(--space-6);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg, 0.5rem);
    background-color: var(--card, var(--background));
    color: var(--foreground);
  }

  .LoginForm__title {
    font-size: 1.125rem;
    font-weight: 600;
  }

  .LoginForm__message {
    font-size: 0.875rem;
    color: var(--muted-foreground);
  }

  .LoginForm__field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    font-size: 0.875rem;
  }

  .LoginForm__error {
    font-size: 0.875rem;
    color: var(--destructive);
  }
</style>
