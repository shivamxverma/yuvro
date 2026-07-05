import fs from "fs";
import path from "path";
import axios from "axios";
import { Request, Response } from "express";
import { BASE_DIR } from "../../config";
import ApiError from "../../utils/ApiError";

export function resolveCppEntry(entryPath: string): string {
  const normalized = (entryPath || "").trim();
  if (!normalized) {
    throw new ApiError("Entry file is required.", 400);
  }

  const absPath = path.resolve(BASE_DIR, normalized);
  const baseResolved = path.resolve(BASE_DIR);
  if (absPath !== baseResolved && !absPath.startsWith(baseResolved + path.sep)) {
    throw new ApiError("Entry file must stay inside the workspace.", 400);
  }
  if (!fs.existsSync(absPath) || !fs.statSync(absPath).isFile()) {
    throw new ApiError("Entry file was not found.", 404);
  }

  const ext = path.extname(absPath).toLowerCase();
  if (ext !== ".cpp" && ext !== ".cc" && ext !== ".cxx") {
    throw new ApiError("Only C++ source files can be executed with this endpoint.", 400);
  }
  return absPath;
}

export async function handleProxy(
  replId: string,
  containerPort: number,
  reqPath: string,
  req: Request,
  res: Response
): Promise<any> {
  const targetUrl = `http://127.0.0.1:${containerPort}/${reqPath}`;
  const proxyPrefix = `/proxy/${replId}/${containerPort}`;

  // Build query
  const query = req.url.split("?")[1] || "";
  const finalUrl = query ? `${targetUrl}?${query}` : targetUrl;

  const headers = { ...req.headers };
  delete headers.host; // let axios handle Host header

  try {
    const response = await axios({
      method: req.method as any,
      url: finalUrl,
      headers,
      data: req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined,
      responseType: "arraybuffer", // handle binary and text responses safely
      validateStatus: () => true, // don't reject on 4xx/5xx status
      timeout: 30000,
    });

    let content = Buffer.from(response.data);
    const contentType = String(response.headers["content-type"] || "").toLowerCase();

    // Perform path re-writings for html and javascript text files
    if (contentType.startsWith("text/html")) {
      let text = content.toString("utf-8");
      text = text.replace(/src="\//g, `src="${proxyPrefix}/`);
      text = text.replace(/href="\//g, `href="${proxyPrefix}/`);
      text = text.replace(/import "\//g, `import "${proxyPrefix}/`);
      content = Buffer.from(text, "utf-8");
    } else if (contentType.includes("javascript")) {
      let text = content.toString("utf-8");
      text = text.replace(/ from "\//g, ` from "${proxyPrefix}/`);
      text = text.replace(/import "\//g, `import "${proxyPrefix}/`);
      text = text.replace(/import\("\//g, `import("${proxyPrefix}/`);
      content = Buffer.from(text, "utf-8");
    }

    // Strip hop-by-hop headers
    const responseHeaders = { ...response.headers };
    const hopByHop = [
      "connection",
      "content-encoding",
      "content-length",
      "keep-alive",
      "proxy-authenticate",
      "proxy-authorization",
      "te",
      "trailer",
      "transfer-encoding",
      "upgrade",
    ];
    for (const header of hopByHop) {
      delete responseHeaders[header];
    }

    res.set(responseHeaders);
    res.status(response.status).send(content);
  } catch (error: any) {
    res.status(503).type("text/plain").send(
      `Cannot connect to container on port ${containerPort} — is the server started?`
    );
  }
}
