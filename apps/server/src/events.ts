import { EventEmitter } from "node:events";

export const dataEvents = new EventEmitter();
// Multiple browser tabs (kiosk view + settings) each hold a long-lived SSE connection
// with a handful of listeners — comfortably exceeds Node's default max of 10 without
// being a real leak.
dataEvents.setMaxListeners(50);

// Panel/config CRUD (including changes detected from a hand-edited YAML file).
export const notifyDataChanged = () => dataEvents.emit("change");

// Per-panel up/down/latency status changed. Payload: a partial map of panelId -> status,
// so the client can patch its state instead of refetching the whole panel list.
export const notifyHealthChanged = (payload: unknown) =>
	dataEvents.emit("health", payload);
