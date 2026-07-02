import fs from "fs";
import path from "path";
import { BASE_DIR } from "../config";

fs.mkdirSync(BASE_DIR, { recursive: true });

export interface FsItem {
  type: "dir" | "file";
  name: string;
  path: string;
}

export async function fetchDir(dirPath: string, relativeBaseDir: string): Promise<FsItem[]> {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const items: FsItem[] = entries.map((entry) => {
    return {
      type: entry.isDirectory() ? "dir" : "file",
      name: entry.name,
      path: relativeBaseDir ? `${relativeBaseDir}/${entry.name}` : entry.name,
    };
  });

  return items.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === "dir" ? -1 : 1; // folders first
    }
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });
}

export async function fetchFileContent(filePath: string): Promise<string> {
  return fs.readFileSync(filePath, "utf-8");
}

export async function saveFile(filePath: string, content: string): Promise<void> {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf-8");
}

export async function createFile(filePath: string): Promise<void> {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, "", "utf-8");
  }
}

export async function createFolder(folderPath: string): Promise<void> {
  fs.mkdirSync(folderPath, { recursive: true });
}

export async function deletePath(targetPath: string): Promise<void> {
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { recursive: true, force: true });
  }
}
