import { useEffect, useRef } from "react"
import { Socket } from "socket.io-client";
import { Terminal } from "xterm";
import { FitAddon } from 'xterm-addon-fit';

const OPTIONS_TERM = {
    cursorBlink: true,
    cols: 200,
    theme: {
        background: "black"
    }
};

export const TerminalManager = ({ socket }: { socket: Socket }) => {
    const terminalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if(!terminalRef || !terminalRef.current || !socket) return ;

        const fitaddon = new FitAddon();
        const term = new Terminal(OPTIONS_TERM);
        term.loadAddon(fitaddon);
        term.open(terminalRef.current);
        fitaddon.fit();

        socket.emit("requestTerminal");
        socket.on("terminal", terminalHandler);

        function terminalHandler({ data }: { data: ArrayBuffer | string }) {
            if (data instanceof ArrayBuffer) {
                console.error(data);
                const decoder = new TextDecoder("utf-8");
                const decodedText = decoder.decode(data);
                console.log(decodedText);
                term.write(decodedText);
            } else if (typeof data === "string") {
                term.write(data);
            }
        }

        term.onData((data: string) => {
            socket.emit('terminalData', {
                data
            });
        });

        socket.emit('terminalData', {
            data: '\n'
        });

        return () => {
            socket.off("terminal", terminalHandler);
            term.dispose();
        }

    }, [terminalRef, socket])

    return <div style={{ width: "40vw", height: "400px", textAlign: "left" }} ref={terminalRef}>
    </div>
}