import fs from "fs";
import path from "path";
import os from "os";
import { exec, execFile } from "child_process";
import { promisify } from "util";
import { BASE_DIR } from "../../config";
import { RunCppResult } from "./workspace-types";
import logger from "../../utils/logger";

const execFileAsync = promisify(execFile);
const PYTHON_PROJECT_TYPES = new Set(["python", "fastapi", "flask", "django"]);

export function setupVirtualenvBg(baseDir: string, projectType: string): void {
  const lowerProjectType = (projectType || "").toLowerCase();
  if (!PYTHON_PROJECT_TYPES.has(lowerProjectType)) {
    logger.info(`[BG] Skipping virtual environment setup for project type '${projectType}'.`);
    return;
  }

  const venvDir = path.join(baseDir, ".venv");
  const requirementsFile = path.join(baseDir, "requirements.txt");

  logger.info(`[BG] Starting virtualenv setup in: ${baseDir}`);

  // Create virtualenv if missing
  const initCmd = fs.existsSync(venvDir)
    ? `"${venvDir}/bin/python" -m ensurepip --upgrade`
    : `python -m venv .venv && ".venv/bin/python" -m ensurepip --upgrade`;

  exec(initCmd, { cwd: baseDir }, (err) => {
    if (err) {
      logger.error(`[BG Setup Error] Failed to initialize virtual environment: ${err}`);
      return;
    }
    logger.info("[BG] Virtual environment and pip ready.");

    if (fs.existsSync(requirementsFile)) {
      logger.info(`[BG] Installing dependencies from requirements.txt...`);
      exec(
        `".venv/bin/python" -m pip install -r requirements.txt -q`,
        { cwd: baseDir },
        (pipErr) => {
          if (pipErr) {
            logger.error(`[BG Setup Error] Pip install failed: ${pipErr}`);
            return;
          }
          logger.info("[BG] Dependencies installed successfully.");
        }
      );
    }
  });
}

export async function runCpp(resolvedEntry: string): Promise<RunCppResult> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "yuvro_cpp_run_"));
  const binaryPath = path.join(tmpDir, "program");

  try {
    // Compile C++ source
    let cOut: string = "";
    let cErr: string = "";
    try {
      const compileRes = await execFileAsync(
        "g++",
        ["-std=c++17", "-O2", "-Wall", "-Wextra", resolvedEntry, "-o", binaryPath],
        { cwd: BASE_DIR, timeout: 30000 }
      );
      cOut = compileRes.stdout;
      cErr = compileRes.stderr;
    } catch (compileError: any) {
      return {
        status: "compile_error",
        exitCode: compileError.code || 1,
        output: `${compileError.stdout || ""}${compileError.stderr || ""}`,
      };
    }

    const compileOutput = `${cOut}${cErr}`;

    // Run binary with 10 seconds timeout
    try {
      const runRes = await execFileAsync(binaryPath, [], {
        cwd: BASE_DIR,
        timeout: 10000,
      });

      return {
        status: "ok",
        exitCode: 0,
        output: `${compileOutput}${runRes.stdout}${runRes.stderr}`,
      };
    } catch (runError: any) {
      const runOutput = `${runError.stdout || ""}${runError.stderr || ""}`;
      if (runError.killed) {
        return {
          status: "timeout",
          exitCode: null,
          output: `${compileOutput}${runOutput}\nExecution timed out after 10 seconds.\n`,
        };
      } else {
        return {
          status: "runtime_error",
          exitCode: runError.code || 1,
          output: `${compileOutput}${runOutput}`,
        };
      }
    }
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore directory cleanup errors
    }
  }
}
