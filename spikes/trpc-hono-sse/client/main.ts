import { createTRPCClient, httpSubscriptionLink } from "@trpc/client";

import type { AppRouter, Projection } from "../src/transport.js";

type TrackedProjection = { id: string; data: Projection };

type BrowserState = {
  connected: boolean;
  events: TrackedProjection[];
  errors: string[];
  lastEventId: string | null;
};

const state: BrowserState = {
  connected: false,
  events: [],
  errors: [],
  lastEventId: null,
};
const seen = new Set<string>();
const client = createTRPCClient<AppRouter>({
  links: [httpSubscriptionLink({ url: `${window.location.origin}/trpc` })],
});
let subscription: { unsubscribe(): void } | undefined;

function render(): void {
  const output = document.querySelector("#state");
  if (output) output.textContent = JSON.stringify(state);
}

function connect(lastEventId: string | null = state.lastEventId): void {
  subscription?.unsubscribe();
  subscription = client.raceLive.subscribe(
    {
      raceId: "race-spike",
      ...(lastEventId ? { lastEventId } : {}),
    },
    {
      onStarted() {
        state.connected = true;
        render();
      },
      onData(event) {
        state.lastEventId = event.id;
        if (!seen.has(event.id)) {
          seen.add(event.id);
          state.events.push(event);
        }
        render();
      },
      onError(error) {
        state.connected = false;
        state.errors.push(error.message);
        render();
      },
      onStopped() {
        state.connected = false;
        render();
      },
    },
  );
}

function disconnect(): void {
  subscription?.unsubscribe();
  subscription = undefined;
  state.connected = false;
  render();
}

declare global {
  interface Window {
    transportSpike: {
      state: BrowserState;
      connect: (lastEventId?: string | null) => void;
      disconnect: () => void;
    };
  }
}

window.transportSpike = { state, connect, disconnect };
connect(null);
render();
