import Editor, { type OnMount } from "@monaco-editor/react";
import { useRef, useState } from "react";
import { type File } from "../utils/file-manager";

interface CodeProps {
    selectedFile: File | undefined;
    onSave: (fileId: string, value: string) => Promise<void>;
    onDraftChange?: (fileId: string, value: string) => void;
    onSaveStatus?: (status: 'saving' | 'saved' | 'idle') => void;
}

export const Code = ({ selectedFile, onSave, onDraftChange, onSaveStatus }: CodeProps) => {
    if (!selectedFile) return null;

    return (
        <CodeSession
            key={selectedFile.id}
            selectedFile={selectedFile}
            onSave={onSave}
            onDraftChange={onDraftChange}
            onSaveStatus={onSaveStatus}
        />
    );
};

const CodeSession = ({ selectedFile, onSave, onDraftChange, onSaveStatus }: CodeProps & { selectedFile: File }) => {
    const fileId = selectedFile.id;
    const code = selectedFile.content ?? "";
    let language = selectedFile.name.split('.').pop();

    if (language === "py") language = "python";
    if (language === "cc" || language === "cxx" || language === "hpp" || language === "h") language = "cpp";

    const [draft, setDraft] = useState(code);
    const latestContentRef = useRef<string>(code);
    const lastSavedContentRef = useRef<string>(code);

    const saveContent = async (value: string) => {
        if (value === lastSavedContentRef.current) {
            onSaveStatus?.('idle');
            return;
        }

        onSaveStatus?.('saving');
        await onSave(fileId, value);
        lastSavedContentRef.current = value;
        latestContentRef.current = value;
        setDraft(value);
        onDraftChange?.(fileId, value);
        onSaveStatus?.('saved');
        setTimeout(() => {
            if (latestContentRef.current === lastSavedContentRef.current) {
                onSaveStatus?.('idle');
            }
        }, 2000);
    };

    const flushDraft = () => {
        void saveContent(latestContentRef.current).catch(() => {
            onSaveStatus?.('idle');
        });
    };

    const handleEditorMount: OnMount = (editor, monaco) => {
        editor.addCommand(
            monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
            () => {
                flushDraft();
            }
        );

        editor.onDidBlurEditorText(() => {
            flushDraft();
        });
    };

    return (
        <Editor
            height="100vh"
            language={language}
            value={draft}
            theme="vs-dark"
            onMount={handleEditorMount}
            onChange={(value) => {
                const nextValue = value ?? "";
                latestContentRef.current = nextValue;
                setDraft(nextValue);
                onDraftChange?.(fileId, nextValue);
                if (nextValue !== lastSavedContentRef.current) {
                    onSaveStatus?.('saving');
                } else {
                    onSaveStatus?.('idle');
                }
            }}
        />
    );
};
