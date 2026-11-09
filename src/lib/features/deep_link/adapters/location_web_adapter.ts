import { pushState, replaceState } from "$app/navigation";
import type { LocationPort } from "$lib/features/deep_link/ports";

// SvelteKit owns the history; its shallow entries change the address
// without a navigation, and the page stays mounted on Back and Forward.
export function create_location_web_adapter(): LocationPort {
  return {
    current: () => new URL(window.location.href),
    push(href) {
      pushState(href, {});
    },
    replace(href) {
      replaceState(href, {});
    },
    on_history_move(listener) {
      const handle = () => {
        listener(new URL(window.location.href));
      };
      window.addEventListener("popstate", handle);
      return () => {
        window.removeEventListener("popstate", handle);
      };
    },
  };
}
