import Editor from "@monaco-editor/react";
import { type File } from "../utils/file-manager";
import { type Socket } from "socket.io-client";

export const Code = ({ selectedFile, socket }: { selectedFile: File | undefined, socket: Socket }) => {
    if (!selectedFile) return null;

    const code = selectedFile.content;
    let language = selectedFile.name.split('.').pop()

    if (language === "py") language = "python"

    function debounce(func: (value: string | undefined) => void, wait: number) {
        let timeout: any;
        return (value: string | undefined) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                func(value);
            }, wait);
        }
    }

    return (
        <Editor
            height="100vh"
            language={language}
            value={code}
            theme="vs-dark"
            onChange={debounce((value) => {
                socket.emit("updateContent", { path: selectedFile.path, content: value || "" });
            }, 500)}>
        </Editor>
    )
}