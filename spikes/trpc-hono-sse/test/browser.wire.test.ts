import { chromium } from "@playwright/test";
import { describe, expect, it } from "vitest";

import { startViteProxy } from "../src/browser-fixture.js";
import {
  RACE_ID,
  ProjectionStore,
  cursorFor,
  startSpikeServer,
} from "../src/transport.js";

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

describe("Vite browser client through a streaming reverse proxy", () => {
  it("reconnects from the exact tracked cursor and releases aborted listeners", async () => {
    const store = new ProjectionStore();
    store.insert(RACE_ID, "grid");
    store.insert(RACE_ID, "lights");
    const api = await startSpikeServer(store);
    const proxy = await startViteProxy(api.url);
    const browser = await chromium.launch({ headless: true });

    try {
      const page = await browser.newPage();
      let streamHeaders: Record<string, string> | undefined;
      page.on("response", async (response) => {
        if (!response.url().includes("/trpc/raceLive")) return;
        const headers = await response.allHeaders();
        if (headers["content-type"]?.startsWith("text/event-stream"))
          streamHeaders = headers;
      });

      await page.goto(proxy.url);
      await page.waitForFunction(
        () => window.transportSpike.state.events.length === 2,
      );

      expect(
        await page.evaluate(() =>
          window.transportSpike.state.events.map((event) => event.id),
        ),
      ).toEqual([cursorFor(RACE_ID, 1), cursorFor(RACE_ID, 2)]);

      await page.waitForTimeout(2_200);
      store.insert(RACE_ID, "heartbeat-survived-idle-window");
      await page.waitForFunction(
        () => window.transportSpike.state.events.length === 3,
      );
      expect(
        await page.evaluate(() => window.transportSpike.state.connected),
      ).toBe(true);

      await page.evaluate(() => window.transportSpike.disconnect());
      await eventually(() => expect(store.listenerCount()).toBe(0));

      store.insert(RACE_ID, "launch-after-reconnect");
      store.insert(RACE_ID, "lead-change-after-reconnect");
      await page.evaluate(() => window.transportSpike.connect());
      await page.waitForFunction(
        () => window.transportSpike.state.events.length === 5,
      );

      const state = await page.evaluate(() => window.transportSpike.state);
      expect(state.events.map((event) => event.id)).toEqual([
        cursorFor(RACE_ID, 1),
        cursorFor(RACE_ID, 2),
        cursorFor(RACE_ID, 3),
        cursorFor(RACE_ID, 4),
        cursorFor(RACE_ID, 5),
      ]);
      expect(new Set(state.events.map((event) => event.id)).size).toBe(5);
      expect(state.lastEventId).toBe(cursorFor(RACE_ID, 5));
      expect(state.errors).toEqual([]);
      expect(streamHeaders?.["content-type"]).toContain("text/event-stream");
      expect(streamHeaders?.["x-accel-buffering"]).toBe("no");
      expect(streamHeaders?.["cache-control"]).toContain("no-transform");

      await page.evaluate(() => window.transportSpike.disconnect());
      await eventually(() => expect(store.listenerCount()).toBe(0));
    } finally {
      await browser.close();
      await proxy.close();
      await api.close();
    }
  });
});
