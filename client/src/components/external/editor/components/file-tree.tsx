import React, { useState } from 'react';
import { type Directory, type File, sortDir, sortFile } from "../utils/file-manager";
import { getIcon } from "./icon";

interface FileTreeProps {
  rootDir: Directory;
  selectedFile: File | undefined;
  onSelect: (file: File) => void;
}

export const FileTree = (props: FileTreeProps) => {
  return <SubTree directory={props.rootDir} {...props} />
}

interface SubTreeProps {
  directory: Directory;
  selectedFile: File | undefined;
  onSelect: (file: File) => void;
}

const SubTree = (props: SubTreeProps) => {
  return (
    <div>
      {
        props.directory.dirs
          .sort(sortDir)
          .map(dir => (
            <React.Fragment key={dir.id}>
              <DirDiv
                directory={dir}
                selectedFile={props.selectedFile}
                onSelect={props.onSelect} />
            </React.Fragment>
          ))
      }
      {
        props.directory.files
          .sort(sortFile)
          .map(file => (
            <React.Fragment key={file.id}>
              <FileDiv
                file={file}
                selectedFile={props.selectedFile}
                onClick={() => props.onSelect(file)} />
            </React.Fragment>
          ))
      }
    </div>
  )
}

const FileDiv = ({ file, icon, selectedFile, onClick }: {
  file: File | Directory;
  icon?: string;
  selectedFile: File | undefined;
  onClick: () => void;
}) => {
  const isSelected = (selectedFile && selectedFile.id === file.id) as boolean;
  const depth = file.depth;
  return (
    <div
      style={{ paddingLeft: `${depth * 12}px` }}
      onClick={onClick}
      className={`flex items-center py-1.5 px-3 gap-2 hover:cursor-pointer transition-colors duration-150 hover:bg-[#242424] ${
        isSelected ? "bg-[#242424] text-white" : "text-slate-400 bg-transparent"
      }`}
    >
      <FileIcon
        name={icon}
        extension={file.name.split('.').pop() || ""} />
      <span className="text-sm select-none truncate">
        {file.name}
      </span>
    </div>
  )
}

const DirDiv = ({ directory, selectedFile, onSelect }: {
  directory: Directory;
  selectedFile: File | undefined;
  onSelect: (file: File) => void;
}) => {
  let defaultOpen = false;
  if (selectedFile) {
    defaultOpen = isChildSelected(directory, selectedFile);
  }
  const [open, setOpen] = useState(defaultOpen);
  return (
    <>
      <FileDiv
        file={directory}
        icon={open ? "openDirectory" : "closedDirectory"}
        selectedFile={selectedFile}
        onClick={() => {
          if (!open) {
            onSelect(directory)
          }
          setOpen(!open)
        }} />
      {
        open ? (
          <SubTree
            directory={directory}
            selectedFile={selectedFile}
            onSelect={onSelect} />
        ) : null
      }
    </>
  )
}

const isChildSelected = (directory: Directory, selectedFile: File) => {
  let res: boolean = false;

  function isChild(dir: Directory, file: File) {
    if (selectedFile.parentId === dir.id) {
      res = true;
      return;
    }
    if (selectedFile.parentId === '0') {
      res = false;
      return;
    }
    dir.dirs.forEach((item) => {
      isChild(item, file);
    })
  }

  isChild(directory, selectedFile);
  return res;
}

const FileIcon = ({ extension, name }: { name?: string, extension?: string }) => {
  const icon = getIcon(extension || "", name || "");
  return (
    <span className="flex w-5 h-5 justify-center items-center shrink-0">
      {icon}
    </span>
  )
}
