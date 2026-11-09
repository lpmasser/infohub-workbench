import type { AssetsPort } from "$lib/features/note/ports";
import { file_url } from "$lib/shared/adapters/web/web_api";

export function create_assets_web_adapter(): AssetsPort {
  return {
    // Same-origin URL; the session cookie authorizes the image request.
    resolve_asset_url(vault_id, asset_path) {
      return file_url(vault_id, asset_path);
    },
    write_image_asset() {
      return Promise.reject(
        new Error("网页版暂不支持粘贴图片，请在本地副本中添加图片文件"),
      );
    },
  };
}
