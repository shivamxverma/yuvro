import { useEffect, useState } from "react";
import { type Socket, io } from 'socket.io-client';
import { useSearchParams } from 'react-router-dom';
import axios from "axios";
import { type File, type RemoteFile, Type} from "./external/editor/utils/file-manager";
import { Editor } from "./editor";
import { Output } from "./output";
import { TerminalManager as Terminal } from "./terminal";

function useSocket(replId: string) {
    const [socket, setSocket] = useState<Socket | null>(null);

    useEffect(() => {
        const newSocket = io(`ws://${replId}.localhost:3001`);
        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, [replId]);

    return socket;
}

export const CodingPage = () => {
    const [podCreated, setPodCreated] = useState(false);
    const [searchParams] = useSearchParams();
    const replId = searchParams.get('replId') ?? '';

    useEffect(() => {
        if(replId) {
            axios.post(`http://localhost:3002/start`, {replId})
                .then(() => setPodCreated(true))
                .catch((err) => console.error(err));
        }
    }, [replId]);

    if (!podCreated) {
        return <>Booting...</>
    }

    return <CodingPagePostPodCreation />
}

export const CodingPagePostPodCreation = () => {
    const [searchParams] = useSearchParams();
    const replId = searchParams.get('replId') ?? '';
    const [loaded, setLoaded] = useState(false);
    const socket = useSocket(replId);
    const [fileStructure, setFileStructure] = useState<RemoteFile[]>([]);
    const [selectedFile, setSelectedFile] = useState<File | undefined>(undefined);
    const [showOutput, setShowOutput] = useState(false);

    useEffect(() => {
        if (socket) {
            socket.on('loaded', ({ rootContent }: { rootContent: RemoteFile[]}) => {
                setLoaded(true);
                setFileStructure(rootContent);
            });
        }
        return () => {
            if (socket) {
                socket.off('loaded');
            }
        };
    }, [socket]);

    const onSelect = (file: File) => {
        if (file.type === Type.DIRECTORY) {
            socket?.emit("fetchDir", file.path, (data: RemoteFile[]) => {
                setFileStructure(prev => {
                    const allFiles = [...prev, ...data];
                    return allFiles.filter((file, index, self) => 
                        index === self.findIndex(f => f.path === file.path)
                    );
                });
            });
        } else {
            socket?.emit("fetchContent", { path: file.path }, (data: string) => {
                file.content = data;
                setSelectedFile(file);
            });
        }
    };
    
    if (!loaded) {
        return <>Loading...</>;
    }

    return (
        <div className="flex flex-col w-full h-screen">
             <div className="flex justify-end p-2 bg-slate-900 border-b border-slate-800">
                <button 
                    onClick={() => setShowOutput(!showOutput)}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition"
                >
                    {showOutput ? "Hide output" : "See output"}
                </button>
            </div>
            <div className="flex flex-1 m-0 text-base w-full overflow-hidden">
                <div className="flex-1 w-[60%] overflow-auto">
                    {socket && (
                        <Editor socket={socket} selectedFile={selectedFile} onSelect={onSelect} files={fileStructure} />
                    )}
                </div>
                <div className="flex-1 w-[40%] flex flex-col overflow-auto border-l border-slate-800 bg-black">
                    {showOutput && <Output />}
                    {socket && <Terminal socket={socket} />}
                </div>
            </div>
        </div>
    );
}