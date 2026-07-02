import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";
import os from "os";
import { exec, execFile } from "child_process";
import { promisify } from "util";
import axios from "axios";
import { BASE_DIR } from "../config";

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);
const router = Router();

const PYTHON_PROJECT_TYPES = new Set(["python", "fastapi", "flask", "django"]);

// Background virtual environment installer
function setupVirtualenvBg(baseDir: string, projectType: string) {
  if (!PYTHON_PROJECT_TYPES.has(projectType)) {
    console.log(`[BG] Skipping virtual environment setup for project type '${projectType}'.`);
    return;
  }

  const venvDir = path.join(baseDir, ".venv");
  const requirementsFile = path.join(baseDir, "requirements.txt");

  console.log(`[BG] Starting virtualenv setup in: ${baseDir}`);

  // Create virtualenv if missing
  const initCmd = fs.existsSync(venvDir)
    ? `"${venvDir}/bin/python" -m ensurepip --upgrade`
    : `python -m venv .venv && ".venv/bin/python" -m ensurepip --upgrade`;

  exec(initCmd, { cwd: baseDir }, (err) => {
    if (err) {
      console.error(`[BG Setup Error] Failed to initialize virtual environment: ${err}`);
      return;
    }
    console.log("[BG] Virtual environment and pip ready.");

    if (fs.existsSync(requirementsFile)) {
      console.log(`[BG] Installing dependencies from requirements.txt...`);
      exec(
        `".venv/bin/python" -m pip install -r requirements.txt -q`,
        { cwd: baseDir },
        (pipErr) => {
          if (pipErr) {
            console.error(`[BG Setup Error] Pip install failed: ${pipErr}`);
            return;
          }
          console.log("[BG] Dependencies installed successfully.");
        }
      );
    }
  });
}

router.post("/start", (req: Request, res: Response) => {
  const projectId = req.body.projectId || "";
  const projectType = (req.body.projectType || "").toLowerCase();

  // Execute in background
  setupVirtualenvBg(BASE_DIR, projectType);

  res.json({
    status: "started",
    message: `Workspace initializing for ${projectId}`,
  });
});

// ─── C++ Runner ──────────────────────────────────────────────────────────────
function resolveCppEntry(entryPath: string): string {
  const normalized = (entryPath || "").trim();
  if (!normalized) {
    throw new Error("Entry file is required.");
  }

  const absPath = path.resolve(BASE_DIR, normalized);
  const baseResolved = path.resolve(BASE_DIR);
  if (absPath !== baseResolved && !absPath.startsWith(baseResolved + path.sep)) {
    throw new Error("Entry file must stay inside the workspace.");
  }
  if (!fs.existsSync(absPath) || !fs.statSync(absPath).isFile()) {
    throw new Error("Entry file was not found.");
  }

  const ext = path.extname(absPath).toLowerCase();
  if (ext !== ".cpp" && ext !== ".cc" && ext !== ".cxx") {
    throw new Error("Only C++ source files can be executed with this endpoint.");
  }
  return absPath;
}

router.post("/run/cpp", async (req: Request, res: Response): Promise<any> => {
  try {
    const entryPath = req.body.entryPath;
    const resolvedEntry = resolveCppEntry(entryPath);

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "yuvro_cpp_run_"));
    const binaryPath = path.join(tmpDir, "program");

    // Compile C++ source
    try {
      const { stdout: cOut, stderr: cErr } = await execFileAsync(
        "g++",
        ["-std=c++17", "-O2", "-Wall", "-Wextra", resolvedEntry, "-o", binaryPath],
        { cwd: BASE_DIR, timeout: 30000 }
      );

      const compileOutput = `${cOut}${cErr}`;

      // Run binary with 10 seconds timeout
      try {
        const { stdout: rOut, stderr: rErr } = await execFileAsync(binaryPath, [], {
          cwd: BASE_DIR,
          timeout: 10000,
        });

        res.json({
          status: "ok",
          exitCode: 0,
          output: `${compileOutput}${rOut}${rErr}`,
        });
      } catch (runError: any) {
        const runOutput = `${runError.stdout || ""}${runError.stderr || ""}`;
        if (runError.killed) {
          res.json({
            status: "timeout",
            exitCode: null,
            output: `${compileOutput}${runOutput}\nExecution timed out after 10 seconds.\n`,
          });
        } else {
          res.json({
            status: "runtime_error",
            exitCode: runError.code || 1,
            output: `${compileOutput}${runOutput}`,
          });
        }
      }
    } catch (compileError: any) {
      res.json({
        status: "compile_error",
        exitCode: compileError.code || 1,
        output: `${compileError.stdout || ""}${compileError.stderr || ""}`,
      });
    } finally {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {}
    }
  } catch (error: any) {
    res.status(400).json({ detail: error.message || String(error) });
  }
});

router.get("/port/:repl_id", (req: Request, res: Response) => {
  const repl_id = req.params.repl_id;
  const container_port = parseInt(req.query.container_port as string, 10) || 8000;
  res.json({
    repl_id,
    container_port,
    host_port: container_port,
  });
});

// ─── Reverse Proxy Handler with rewriting ───────────────────────────────────
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

// Proxy routes matching the paths directly
router.all("/proxy/:repl_id/:container_port/:path(*)", (req: Request, res: Response) => {
  const replId = typeof req.params.repl_id === "string" ? req.params.repl_id : "";
  const containerPort = typeof req.params.container_port === "string" ? req.params.container_port : "";
  const reqPath = typeof req.params.path === "string" ? req.params.path : "";
  handleProxy(replId, parseInt(containerPort, 10), reqPath, req, res);
});

router.all("/proxy/:repl_id/:path(*)", (req: Request, res: Response) => {
  const replId = typeof req.params.repl_id === "string" ? req.params.repl_id : "";
  const reqPath = typeof req.params.path === "string" ? req.params.path : "";
  handleProxy(replId, 8000, reqPath, req, res);
});

export default router;
