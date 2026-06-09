import { type ReactNode } from "react";
import { FileCode, FileJson, FileImage, FileText, Folder, FolderOpen, File } from "lucide-react";

function getIconHelper() {
  const cache = new Map<string, ReactNode>();
  cache.set("js", <FileCode className="w-4 h-4 text-yellow-500" />);
  cache.set("jsx", <FileCode className="w-4 h-4 text-yellow-500" />);
  cache.set("ts", <FileCode className="w-4 h-4 text-blue-400" />);
  cache.set("tsx", <FileCode className="w-4 h-4 text-blue-400" />);
  cache.set("css", <FileCode className="w-4 h-4 text-purple-400" />);
  cache.set("json", <FileJson className="w-4 h-4 text-cyan-400" />);
  cache.set("html", <FileCode className="w-4 h-4 text-orange-500" />);
  cache.set("png", <FileImage className="w-4 h-4 text-green-400" />);
  cache.set("jpg", <FileImage className="w-4 h-4 text-green-400" />);
  cache.set("ico", <FileImage className="w-4 h-4 text-green-400" />);
  cache.set("txt", <FileText className="w-4 h-4 text-slate-400" />);
  cache.set("closedDirectory", <Folder className="w-4 h-4 text-yellow-600 fill-yellow-600/20" />);
  cache.set("openDirectory", <FolderOpen className="w-4 h-4 text-yellow-600 fill-yellow-600/20" />);

  return function (extension: string, name: string): ReactNode {
    if (cache.has(extension))
      return cache.get(extension);
    else if (cache.has(name))
      return cache.get(name);
    else
      return <File className="w-4 h-4 text-slate-400" />;
  }
}

export const getIcon = getIconHelper();
