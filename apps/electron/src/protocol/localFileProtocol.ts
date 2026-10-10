import { net, protocol } from "electron";
import * as fs from "fs";
import * as path from "path";
import { pathToFileURL } from "url";
import { isPathInsideWorkspace } from "../workspace/state";
import {
  IMAGE_MIME_TYPES,
  LOCAL_FILE_SCHEME,
  resolveProtocolPath,
} from "./localImagePolicy";

// 必须在 app ready 之前调用，注册 wemd-file 特权 scheme
export function registerLocalFileScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: LOCAL_FILE_SCHEME,
      privileges: { stream: true, bypassCSP: true, secure: true },
    },
  ]);
}

// app ready 之后注册 handler，将 wemd-file://local/<encodedPath> 映射到工作区内图片
export function registerLocalFileProtocolHandler(): void {
  protocol.handle(LOCAL_FILE_SCHEME, async (request) => {
    const resolved = resolveProtocolPath(request.url, isPathInsideWorkspace);
    if (!resolved.ok) {
      return new Response(resolved.error, { status: resolved.status });
    }

    const { absolutePath } = resolved;
    if (!fs.existsSync(absolutePath)) {
      return new Response("Not Found", { status: 404 });
    }

    const response = await net.fetch(pathToFileURL(absolutePath).toString());
    const extension = path.extname(absolutePath).slice(1).toLowerCase();
    const mime = IMAGE_MIME_TYPES[extension];
    if (!mime) return response;

    // svg 等类型确保带正确的 Content-Type
    const headers = new Headers(response.headers);
    headers.set("Content-Type", mime);
    return new Response(response.body, {
      status: response.status,
      headers,
    });
  });
}
