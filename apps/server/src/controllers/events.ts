import { Elysia, sse } from "elysia";
import { dataEvents } from "../events";
import { trackSseClient } from "../telemetry";

const HEARTBEAT_MS = 30_000;

type ChangeKind = "change" | "health";

// Resolves on the first of: a data change, a health change, the request aborting, or the
// heartbeat elapsing (false). Every outcome runs the same cleanup — including the heartbeat,
// which previously lived in a separate Promise.race arm and left this wait's listeners attached
// whenever it won, accumulating one set per connected client every HEARTBEAT_MS.
export function waitForEventOrAbort(
	signal: AbortSignal,
	heartbeatMs = HEARTBEAT_MS,
): Promise<ChangeKind | { health: unknown } | false> {
	return new Promise((resolve) => {
		const cleanup = () => {
			clearTimeout(heartbeat);
			dataEvents.off("change", onChange);
			dataEvents.off("health", onHealth);
			signal.removeEventListener("abort", onAbort);
		};
		const onChange = () => {
			cleanup();
			resolve("change");
		};
		const onHealth = (payload: unknown) => {
			cleanup();
			resolve({ health: payload });
		};
		const onAbort = () => {
			cleanup();
			resolve(false);
		};
		const heartbeat = setTimeout(onAbort, heartbeatMs);
		dataEvents.once("change", onChange);
		dataEvents.once("health", onHealth);
		signal.addEventListener("abort", onAbort, { once: true });
	});
}

export const eventsController = new Elysia().get(
	"/events",
	async function* ({ request }) {
		const release = trackSseClient();
		try {
			while (!request.signal.aborted) {
				const result = await waitForEventOrAbort(request.signal);
				if (request.signal.aborted) return;
				// A `data` field is required — per the SSE spec, EventSource silently drops
				// event blocks whose data buffer is empty, so `event` alone never dispatches.
				if (result === "change") {
					yield sse({ event: "change", data: "change" });
				} else if (result && typeof result === "object" && "health" in result) {
					yield sse({ event: "health", data: JSON.stringify(result.health) });
				} else {
					yield sse({ event: "ping", data: "ping" });
				}
			}
		} finally {
			release();
		}
	},
);
