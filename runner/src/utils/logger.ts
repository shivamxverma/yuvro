import { logToFile } from '../config';

const logger = {
  info: (msg: string, ...args: any[]) => {
    const formatted = `[INFO] ${msg} ${args.length ? JSON.stringify(args) : ''}`;
    console.log(formatted);
    logToFile(formatted);
  },
  error: (msg: string, ...args: any[]) => {
    const formatted = `[ERROR] ${msg} ${args.length ? JSON.stringify(args) : ''}`;
    console.error(formatted);
    logToFile(formatted);
  },
  warn: (msg: string, ...args: any[]) => {
    const formatted = `[WARN] ${msg} ${args.length ? JSON.stringify(args) : ''}`;
    console.warn(formatted);
    logToFile(formatted);
  },
  debug: (msg: string, ...args: any[]) => {
    const formatted = `[DEBUG] ${msg} ${args.length ? JSON.stringify(args) : ''}`;
    console.debug(formatted);
    logToFile(formatted);
  }
};

export default logger;
export { logger };
