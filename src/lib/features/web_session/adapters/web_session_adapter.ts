import type {
  WebSessionInfo,
  WebSessionPort,
} from "$lib/features/web_session/ports";
import { WebApiError, type WebApi } from "$lib/shared/adapters/web/web_api";
import type { WebEvents } from "$lib/shared/adapters/web/web_events";

type SessionResponse = { version: 1; username: string; expiresAt: string };

function to_info(response: SessionResponse): WebSessionInfo {
  return { username: response.username, expires_at: response.expiresAt };
}

export function create_web_session_adapter(
  api: WebApi,
  events: WebEvents,
): WebSessionPort {
  return {
    async current() {
      try {
        return to_info(await api.get_json<SessionResponse>("/api/session", 1));
      } catch (error) {
        if (error instanceof WebApiError && error.status === 401) return null;
        throw error;
      }
    },
    async login(username, password) {
      try {
        const info = to_info(
          await api.post_json<SessionResponse>("/api/login", 1, {
            username,
            password,
          }),
        );
        events.resume();
        return info;
      } catch (error) {
        if (error instanceof WebApiError && error.status === 401)
          throw new Error("用户名或密码错误");
        throw error;
      }
    },
    async logout() {
      events.close();
      await api.post_json("/api/logout", 1, {});
    },
    on_signed_out: (listener) => api.on_unauthenticated(listener),
  };
}
