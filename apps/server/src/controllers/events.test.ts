import { describe, expect, test } from "bun:test";
import { dataEvents } from "../events";
import { eventsController } from "./events";

// The `sse()`-wrapped route resolves its Response only once the generator produces its
// first chunk (or returns without yielding) — so the triggering event must be emitted
// *before* awaiting the handle() promise, never after.
async function fireAndRead(fire: () => void) {
	const controller = new AbortController();
	const request = new Request("http://localhost/events", {
		signal: controller.signal,
	});
	const responsePromise = eventsController.handle(request);
	// give the generator a tick to reach its Promise.race and register listeners
	await new Promise((resolve) => setTimeout(resolve, 20));
	fire();
	const response = await responsePromise;
	// biome-ignore lint/style/noNonNullAssertion: the sse route always returns a body
	const reader = response.body!.getReader();
	const result = await reader.read();
	controller.abort();
	await reader.cancel();
	return result;
}

describe("GET /events", () => {
	test("emits a change SSE event when a data-changed event fires", async () => {
		// Act
		const { value, done } = await fireAndRead(() => dataEvents.emit("change"));

		// Assert
		expect(done).toBe(false);
		expect(value).toContain("event: change");
		expect(value).toContain("data: change");
	});

	test("emits a health SSE event carrying the JSON-encoded payload", async () => {
		// Arrange
		const payload = { "1": { ms: 42, bucket: "fast" } };

		// Act
		const { value, done } = await fireAndRead(() =>
			dataEvents.emit("health", payload),
		);

		// Assert
		expect(done).toBe(false);
		expect(value).toContain("event: health");
		expect(value).toContain(JSON.stringify(payload));
	});

	test("closes the stream immediately when the request is already aborted", async () => {
		// Arrange
		const controller = new AbortController();
		controller.abort();
		const request = new Request("http://localhost/events", {
			signal: controller.signal,
		});

		// Act
		const response = await eventsController.handle(request);
		// biome-ignore lint/style/noNonNullAssertion: the sse route always returns a body
		const reader = response.body!.getReader();
		const { done } = await reader.read();

		// Assert
		expect(done).toBe(true);
	});

	test("removes its dataEvents listeners once the request is aborted mid-wait", async () => {
		// Arrange
		const changeListenersBefore = dataEvents.listenerCount("change");
		const controller = new AbortController();
		const request = new Request("http://localhost/events", {
			signal: controller.signal,
		});
		const responsePromise = eventsController.handle(request);
		await new Promise((resolve) => setTimeout(resolve, 20));

		// Act — aborting mid-wait resolves the pending race and tears down its listeners
		controller.abort();
		const response = await responsePromise;
		// biome-ignore lint/style/noNonNullAssertion: the sse route always returns a body
		const reader = response.body!.getReader();
		await reader.read();

		// Assert
		expect(dataEvents.listenerCount("change")).toBe(changeListenersBefore);
	});
});
