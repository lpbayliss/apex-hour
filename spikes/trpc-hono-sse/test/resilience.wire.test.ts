import { describe, expect, it } from "vitest";

import {
  RACE_ID,
  ProjectionStore,
  createNodeClient,
  cursorFor,
  sequenceFromCursor,
  startSpikeServer,
  type Projection,
} from "../src/transport.js";

type TrackedProjection = { id: string; data: Projection };

async function eventually(
  assertion: () => void,
  timeoutMs = 3_000,
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

describe("tracked SSE failure behavior after headers", () => {
  it("closes an overflowing slow consumer with a resumable cursor and catches up", async () => {
    const store = new ProjectionStore({ queueLimit: 2, liveYieldDelayMs: 50 });
    const api = await startSpikeServer(store);
    const client = createNodeClient(api.url);

    try {
      const received: TrackedProjection[] = [];
      let overflowMessage = "";
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error("Timed out waiting for overflow")),
          5_000,
        );
        client.raceLive.subscribe(
          { raceId: RACE_ID },
          {
            onStarted() {
              for (let sequence = 1; sequence <= 6; sequence += 1) {
                store.insert(RACE_ID, `burst-${sequence}`);
              }
            },
            onData(event) {
              received.push(event);
            },
            onError(error) {
              clearTimeout(timeout);
              overflowMessage = error.message;
              resolve();
            },
          },
        );
      });

      expect(overflowMessage).toContain("SSE_QUEUE_OVERFLOW");
      expect(received.length).toBeGreaterThan(0);
      expect(received.length).toBeLessThan(6);
      const resumeCursor = received.at(-1)?.id;
      expect(resumeCursor).toBeTruthy();
      await eventually(() => expect(store.listenerCount()).toBe(0));

      const resumed: TrackedProjection[] = [];
      let resumedSubscription: { unsubscribe(): void } | undefined;
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error("Timed out waiting for resume")),
          5_000,
        );
        resumedSubscription = client.raceLive.subscribe(
          { raceId: RACE_ID, lastEventId: resumeCursor },
          {
            onData(event) {
              resumed.push(event);
              if (event.id !== cursorFor(RACE_ID, 6)) return;
              clearTimeout(timeout);
              resumedSubscription?.unsubscribe();
              resolve();
            },
            onError(error) {
              clearTimeout(timeout);
              reject(error);
            },
          },
        );
      });

      const lastSeenSequence = sequenceFromCursor(RACE_ID, resumeCursor);
      expect(resumed.map((event) => event.id)).toEqual(
        Array.from({ length: 6 - lastSeenSequence }, (_, index) =>
          cursorFor(RACE_ID, lastSeenSequence + index + 1),
        ),
      );
      await eventually(() => expect(store.listenerCount()).toBe(0));
    } finally {
      await api.close();
    }
  });

  it("delivers a tracked item before a terminal stream error and cleans up", async () => {
    const store = new ProjectionStore({ terminalAfterSequence: 1 });
    const api = await startSpikeServer(store);
    const client = createNodeClient(api.url);

    try {
      const received: TrackedProjection[] = [];
      let terminalMessage = "";
      let terminalSubscription: { unsubscribe(): void } | undefined;
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          terminalSubscription?.unsubscribe();
          reject(new Error("Timed out waiting for terminal error"));
        }, 5_000);
        terminalSubscription = client.raceLive.subscribe(
          { raceId: RACE_ID },
          {
            onStarted() {
              store.insert(RACE_ID, "terminal-after-this-event");
            },
            onData(event) {
              received.push(event);
            },
            onError(error) {
              clearTimeout(timeout);
              terminalMessage = error.message;
              terminalSubscription?.unsubscribe();
              resolve();
            },
          },
        );
      });

      expect(received.map((event) => event.id)).toEqual([
        cursorFor(RACE_ID, 1),
      ]);
      expect(terminalMessage).toContain("SPIKE_TERMINAL_AFTER_HEADERS");
      expect(terminalMessage).toContain(cursorFor(RACE_ID, 1));
      await eventually(() => expect(store.listenerCount()).toBe(0));
    } finally {
      await api.close();
    }
  });
});
