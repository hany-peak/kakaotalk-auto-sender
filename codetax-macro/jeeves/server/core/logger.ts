import type { SSEManager } from './sse';
import type { LogFn } from '../plugins/types';

export function createLogger(sse: SSEManager): { log: LogFn; logError: LogFn } {
  const log: LogFn = (msg) => {
    console.log(msg);
    sse.broadcast('log', msg);
  };

  const logError: LogFn = (msg) => {
    console.error(msg);
    sse.broadcast('error', msg);
  };

  return { log, logError };
}
