/**
 * Robust SSE emitter with heartbeat keep-alive.
 * Prevents connection timeouts during long-running tool executions.
 */
export class SSEEmitter {
  private controller: ReadableStreamDefaultController | null = null;
  private encoder = new TextEncoder();
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private closed = false;

  readonly stream: ReadableStream;

  constructor(heartbeatMs = 15_000) {
    this.stream = new ReadableStream({
      start: (c) => {
        this.controller = c;
      },
      cancel: () => {
        this.cleanup();
      },
    });

    // Send heartbeat every N seconds to prevent connection timeout
    this.heartbeatInterval = setInterval(() => {
      this.send("heartbeat", {});
    }, heartbeatMs);
  }

  send(event: string, data: unknown): void {
    if (this.closed || !this.controller) return;
    try {
      const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      this.controller.enqueue(this.encoder.encode(payload));
    } catch {
      this.cleanup();
    }
  }

  close(): void {
    this.cleanup();
    try {
      this.controller?.close();
    } catch {
      /* already closed */
    }
  }

  private cleanup(): void {
    this.closed = true;
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}
