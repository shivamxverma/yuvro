import Editor from "@monaco-editor/react";
import { useRef, useEffect } from "react";
import { type File } from "../utils/file-manager";

interface CodeProps {
    selectedFile: File | undefined;
    onSave: (fileId: string, value: string) => Promise<void>;
    onSaveStatus?: (status: 'saving' | 'saved' | 'idle') => void;
}

export const Code = ({ selectedFile, onSave, onSaveStatus }: CodeProps) => {
    if (!selectedFile) return null;

    const code = selectedFile.content;
    let language = selectedFile.name.split('.').pop()

    if (language === "py") language = "python"

    const latestContentRef = useRef<string>(code ?? "");
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const fileId = selectedFile.id;

    useEffect(() => {
        latestContentRef.current = code ?? "";
    }, [code]);

    const saveContent = (value: string) => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = null;
        }
        onSaveStatus?.('saving');
        void onSave(fileId, value).then(() => {
            onSaveStatus?.('saved');
            setTimeout(() => onSaveStatus?.('idle'), 2000);
        });
    };

    const debouncedSave = (value: string) => {
        latestContentRef.current = value;
        onSaveStatus?.('saving');
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
            saveContent(value);
        }, 300);
    };

    const handleEditorMount = (_editor: any, monaco: any) => {
        _editor.addCommand(
            monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
            () => {
                saveContent(latestContentRef.current);
            }
        );
    };

    return (
        <Editor
            height="100vh"
            language={language}
            value={code}
            theme="vs-dark"
            onMount={handleEditorMount}
            onChange={(value) => {
                debouncedSave(value ?? "");
            }}
        />
    );
}
