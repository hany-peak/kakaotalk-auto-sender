import type { Express } from 'express';
import type { ServerContext } from '../types';

export function registerThebillRoutes(_app: Express, _ctx: ServerContext): void {
  // All UI interactions go through the shared /api/scheduler/* endpoints.
  // This file exists only to satisfy the MacroPlugin.registerRoutes contract.
}
