export const Type = {
  FILE: 0,
  DIRECTORY: 1,
  DUMMY: 2,
} as const;

export type Type = (typeof Type)[keyof typeof Type];

interface CommonProps {
  id: string;
  type: Type;
  name: string;
  content?: string;
  path: string;
  parentId: string | null;
  depth: number;
}

export interface File extends CommonProps {}

export interface RemoteFile {
  id: string;
  parentId: string | null;
  type: "FILE" | "FOLDER";
  name: string;
  path: string;
  isRoot?: boolean;
}

export interface Directory extends CommonProps {
  files: File[];
  dirs: Directory[];
}

export function buildFileTree(data: RemoteFile[]): Directory {
  const visibleNodes = data.filter((item) => !item.isRoot);
  const cache = new Map<string, Directory | File>();
  const rootDir: Directory = {
    id: "root",
    name: "root",
    parentId: null,
    type: Type.DIRECTORY,
    path: "",
    depth: 0,
    dirs: [],
    files: [],
  };

  visibleNodes.forEach((item) => {
    if (item.type === "FOLDER") {
      cache.set(item.id, {
        id: item.id,
        name: item.name,
        path: item.path,
        parentId: item.parentId,
        type: Type.DIRECTORY,
        depth: 0,
        dirs: [],
        files: [],
      });
      return;
    }

    cache.set(item.id, {
      id: item.id,
      name: item.name,
      path: item.path,
      parentId: item.parentId,
      type: Type.FILE,
      depth: 0,
    });
  });

  cache.forEach((value) => {
    const parentId = value.parentId;
    if (!parentId || !cache.has(parentId)) {
      if (value.type === Type.DIRECTORY) rootDir.dirs.push(value as Directory);
      else rootDir.files.push(value as File);
      return;
    }

    const parentDir = cache.get(parentId) as Directory | undefined;
    if (!parentDir || parentDir.type !== Type.DIRECTORY) {
      if (value.type === Type.DIRECTORY) rootDir.dirs.push(value as Directory);
      else rootDir.files.push(value as File);
      return;
    }

    if (value.type === Type.DIRECTORY) parentDir.dirs.push(value as Directory);
    else parentDir.files.push(value as File);
  });

  getDepth(rootDir, 0);
  return rootDir;
}

function getDepth(rootDir: Directory, curDepth: number) {
  rootDir.files.forEach((file) => {
    file.depth = curDepth + 1;
  });
  rootDir.dirs.forEach((dir) => {
    dir.depth = curDepth + 1;
    getDepth(dir, curDepth + 1);
  });
}

export function findFileByName(rootDir: Directory, filename: string): File | undefined {
  let targetFile: File | undefined;

  function findFile(dir: Directory, needle: string) {
    dir.files.forEach((file) => {
      if (file.name === needle) {
        targetFile = file;
      }
    });
    dir.dirs.forEach((childDir) => {
      findFile(childDir, needle);
    });
  }

  findFile(rootDir, filename);
  return targetFile;
}

export function sortDir(l: Directory, r: Directory) {
  return l.name.localeCompare(r.name);
}

export function sortFile(l: File, r: File) {
  return l.name.localeCompare(r.name);
}
