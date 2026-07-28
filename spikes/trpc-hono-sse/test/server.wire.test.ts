import { afterEach, describe, expect, it } from "vitest";
import { EventSource, type EventSourceInit } from "eventsource";

import {
  RACE_ID,
  ProjectionStore,
  createNodeClient,
  cursorFor,
  startSpikeServer,
  type Projection,
} from "../src/transport.js";

const openServers: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(openServers.splice(0).map((close) => close()));
});

async function eventually(
  assertion: () => void,
  timeoutMs = 2_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
  throw lastError;
}

describe("official tRPC Fetch adapter mounted in a real Hono Node server", () => {
  it("serves a query and a tracked SSE stream with listener-before-catch-up ordering", async () => {
    const store = new ProjectionStore();
    const first = store.insert(RACE_ID, "grid");
    const second = store.insert(RACE_ID, "lights");
    const third = store.insert(RACE_ID, "launch");
    let insertedDuringCatchUp: Projection | undefined;
    store.onAfterPageRead((page) => {
      if (page !== 1) return;
      insertedDuringCatchUp = store.insert(RACE_ID, "lead-change");
      store.republish(second);
    });

    const fixture = await startSpikeServer(store);
    openServers.push(fixture.close);

    let responseHeaders: Headers | undefined;
    class CapturingEventSource extends EventSource {
      constructor(url: string | URL, init?: EventSourceInit) {
        super(url, {
          ...init,
          fetch: async (input, requestInit) => {
            const response = await fetch(input, requestInit as RequestInit);
            responseHeaders = new Headers(response.headers);
            return response;
          },
        });
      }
    }

    const client = createNodeClient(fixture.url, CapturingEventSource);
    await expect(client.status.query()).resolves.toEqual({ status: "ok" });

    const received: Array<{ id: string; data: Projection }> = [];
    let subscription: { unsubscribe(): void } | undefined;
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Timed out waiting for tracked events")),
        5_000,
      );
      subscription = client.raceLive.subscribe(
        { raceId: RACE_ID },
        {
          onData(event) {
            received.push(event);
            if (received.length !== 4) return;
            clearTimeout(timeout);
            subscription?.unsubscribe();
            resolve();
          },
          onError(error) {
            clearTimeout(timeout);
            reject(error);
          },
        },
      );
    });

    expect(received.map((event) => event.data)).toEqual([
      first,
      second,
      third,
      insertedDuringCatchUp,
    ]);
    expect(received.map((event) => event.id)).toEqual([
      cursorFor(RACE_ID, 1),
      cursorFor(RACE_ID, 2),
      cursorFor(RACE_ID, 3),
      cursorFor(RACE_ID, 4),
    ]);
    expect(new Set(received.map((event) => event.id)).size).toBe(4);
    expect(responseHeaders?.get("content-type")).toContain("text/event-stream");
    expect(responseHeaders?.get("x-accel-buffering")).toBe("no");
    expect(responseHeaders?.get("cache-control")).toContain("no-transform");

    await eventually(() => expect(store.listenerCount()).toBe(0));
  });
});
