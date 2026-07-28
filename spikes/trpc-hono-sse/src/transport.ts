import { serve, type ServerType } from "@hono/node-server";
import {
  createTRPCClient,
  httpBatchLink,
  httpSubscriptionLink,
  splitLink,
} from "@trpc/client";
import { initTRPC, tracked } from "@trpc/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { EventSource } from "eventsource";
import { Hono } from "hono";
import { z } from "zod";

export const RACE_ID = "race-spike";

export type Projection = {
  raceId: string;
  sequence: number;
  cursor: string;
  message: string;
};

export function cursorFor(raceId: string, sequence: number): string {
  return `race/${raceId}/publication/${sequence}`;
}

export function sequenceFromCursor(
  raceId: string,
  cursor?: string | null,
): number {
  if (!cursor) return 0;
  const match = /^race\/([^/]+)\/publication\/(\d+)$/.exec(cursor);
  if (!match || match[1] !== raceId) {
    throw new Error(`Cursor does not belong to race ${raceId}`);
  }
  return Number(match[2]);
}

export class ProjectionStore {
  readonly #events: Projection[] = [];
  readonly #listeners = new Set<(event: Projection) => void>();
  #afterPageRead: ((page: number) => void | Promise<void>) | undefined;
  #pagesRead = 0;

  insert(raceId: string, message: string): Projection {
    const sequence =
      (this.#events.findLast((event) => event.raceId === raceId)?.sequence ??
        0) + 1;
    const event = {
      raceId,
      sequence,
      cursor: cursorFor(raceId, sequence),
      message,
    };
    this.#events.push(event);
    for (const listener of this.#listeners) listener(event);
    return event;
  }

  republish(event: Projection): void {
    for (const listener of this.#listeners) listener(event);
  }

  highWater(raceId: string): number {
    return (
      this.#events.findLast((event) => event.raceId === raceId)?.sequence ?? 0
    );
  }

  async pageAfter(
    raceId: string,
    afterSequence: number,
    throughSequence: number,
    pageSize: number,
  ): Promise<Projection[]> {
    const page = this.#events
      .filter(
        (event) =>
          event.raceId === raceId &&
          event.sequence > afterSequence &&
          event.sequence <= throughSequence,
      )
      .slice(0, pageSize);
    this.#pagesRead += 1;
    await this.#afterPageRead?.(this.#pagesRead);
    return page;
  }

  onAfterPageRead(callback: (page: number) => void | Promise<void>): void {
    this.#afterPageRead = callback;
  }

  listen(listener: (event: Projection) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  listenerCount(): number {
    return this.#listeners.size;
  }
}

class AsyncQueue<T> implements AsyncIterableIterator<T> {
  readonly #values: T[] = [];
  readonly #waiters: Array<(result: IteratorResult<T>) => void> = [];
  #closed = false;

  push(value: T): void {
    if (this.#closed) return;
    const waiter = this.#waiters.shift();
    if (waiter) waiter({ done: false, value });
    else this.#values.push(value);
  }

  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    for (const waiter of this.#waiters.splice(0))
      waiter({ done: true, value: undefined });
  }

  next(): Promise<IteratorResult<T>> {
    const value = this.#values.shift();
    if (value !== undefined) return Promise.resolve({ done: false, value });
    if (this.#closed) return Promise.resolve({ done: true, value: undefined });
    return new Promise((resolve) => this.#waiters.push(resolve));
  }

  [Symbol.asyncIterator](): AsyncIterableIterator<T> {
    return this;
  }
}

const t = initTRPC.create({
  sse: {
    ping: { enabled: true, intervalMs: 100 },
    client: { reconnectAfterInactivityMs: 500 },
    maxDurationMs: 10_000,
  },
});

const liveInput = z.object({
  raceId: z.string().min(1),
  lastEventId: z.string().nullish(),
});

export function createRouter(store: ProjectionStore) {
  return t.router({
    status: t.procedure.query(() => ({ status: "ok" as const })),
    raceLive: t.procedure.input(liveInput).subscription(async function* ({
      input,
      signal,
    }) {
      const queue = new AsyncQueue<Projection>();
      const unsubscribe = store.listen((event) => {
        if (event.raceId === input.raceId) queue.push(event);
      });
      const abort = () => queue.close();
      signal?.addEventListener("abort", abort, { once: true });

      let lastSequence = sequenceFromCursor(input.raceId, input.lastEventId);
      const highWater = store.highWater(input.raceId);

      try {
        while (lastSequence < highWater) {
          const page = await store.pageAfter(
            input.raceId,
            lastSequence,
            highWater,
            2,
          );
          if (page.length === 0) break;
          for (const event of page) {
            if (event.sequence <= lastSequence) continue;
            lastSequence = event.sequence;
            yield tracked(event.cursor, event);
          }
        }

        for await (const event of queue) {
          if (event.sequence <= lastSequence) continue;
          lastSequence = event.sequence;
          yield tracked(event.cursor, event);
        }
      } finally {
        signal?.removeEventListener("abort", abort);
        unsubscribe();
        queue.close();
      }
    }),
  });
}

export type AppRouter = ReturnType<typeof createRouter>;

export function createApp(store: ProjectionStore) {
  const router = createRouter(store);
  const app = new Hono();

  app.all("/trpc/*", async (context) => {
    const response = await fetchRequestHandler({
      endpoint: "/trpc",
      req: context.req.raw,
      router,
      createContext: () => ({}),
    });
    if (!response.headers.get("content-type")?.startsWith("text/event-stream"))
      return response;

    const headers = new Headers(response.headers);
    headers.set("x-accel-buffering", "no");
    headers.set("cache-control", "no-cache, no-transform");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  });

  return { app, router };
}

export async function startSpikeServer(store = new ProjectionStore()): Promise<{
  store: ProjectionStore;
  server: ServerType;
  url: string;
  close: () => Promise<void>;
}> {
  const { app } = createApp(store);
  const server = serve({ fetch: app.fetch, port: 0 });
  await new Promise<void>((resolve) => {
    if (server.listening) resolve();
    else server.once("listening", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Expected TCP server address");

  return {
    store,
    server,
    url: `http://127.0.0.1:${address.port}/trpc`,
    close: () =>
      new Promise((resolve, reject) =>
        server.close((error?: Error) => (error ? reject(error) : resolve())),
      ),
  };
}

export function createNodeClient(
  url: string,
  EventSourceImpl: typeof EventSource = EventSource,
) {
  return createTRPCClient<AppRouter>({
    links: [
      splitLink({
        condition: (operation) => operation.type === "subscription",
        true: httpSubscriptionLink({
          url,
          EventSource: EventSourceImpl,
        }),
        false: httpBatchLink({ url }),
      }),
    ],
  });
}
