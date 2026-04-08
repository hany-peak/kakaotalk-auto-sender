import type { Response } from 'express';

export class SSEManager {
  private clients = new Set<Response>();

  addClient(res: Response): void {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    this.clients.add(res);
    res.req?.on('close', () => this.clients.delete(res));
  }

  broadcast(type: string, message: any): void {
    const data = JSON.stringify({
      type,
      message,
      time: new Date().toLocaleTimeString('ko-KR'),
    });
    for (const client of this.clients) {
      client.write(`data: ${data}\n\n`);
    }
  }
}
