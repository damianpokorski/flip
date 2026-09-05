import { Elysia, sse } from "elysia";
import { dataEvents } from "../events";

const HEARTBEAT_MS = 30_000;

type ChangeKind = "change" | "health";

function waitForEventOrAbort(
	signal: AbortSignal,
): Promise<ChangeKind | { health: unknown } | false> {
	return new Promise((resolve) => {
		const cleanup = () => {
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
		dataEvents.once("change", onChange);
		dataEvents.once("health", onHealth);
		signal.addEventListener("abort", onAbort, { once: true });
	});
}

export const eventsController = new Elysia().get(
	"/events",
	async function* ({ request }) {
		while (!request.signal.aborted) {
			const heartbeat = new Promise<false>((resolve) =>
				setTimeout(() => resolve(false), HEARTBEAT_MS),
			);
			const result = await Promise.race([
				waitForEventOrAbort(request.signal),
				heartbeat,
			]);
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
	},
);
