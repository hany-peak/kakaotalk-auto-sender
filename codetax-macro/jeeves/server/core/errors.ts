import type { Request, Response, NextFunction } from 'express';
import type { ServerContext, RequestHandler } from '../plugins/types';

export class MacroError extends Error {
  constructor(
    message: string,
    public code: string,
    public recoverable: boolean = false,
  ) {
    super(message);
    this.name = 'MacroError';
  }
}

export function withErrorHandler(
  ctx: ServerContext,
  handler: RequestHandler,
): (req: Request, res: Response, next: NextFunction) => void {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (err) {
      if (err instanceof MacroError) {
        ctx.logError(`[${err.code}] ${err.message}`);
        res.status(err.recoverable ? 409 : 500).json({
          error: err.message,
          code: err.code,
        });
      } else {
        const message = err instanceof Error ? err.message : String(err);
        ctx.logError(`unexpected error: ${message}`);
        res.status(500).json({ error: 'server error' });
      }
    }
  };
}
