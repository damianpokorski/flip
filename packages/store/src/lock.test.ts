import { describe, expect, test } from "bun:test";
import { AsyncLock } from "./lock";

describe("AsyncLock", () => {
	test("serializes overlapping runs so they never execute concurrently", async () => {
		// Arrange
		const lock = new AsyncLock();
		let active = 0;
		let maxActive = 0;
		const task = async () => {
			active += 1;
			maxActive = Math.max(maxActive, active);
			await new Promise((resolve) => setTimeout(resolve, 5));
			active -= 1;
		};

		// Act
		await Promise.all([lock.run(task), lock.run(task), lock.run(task)]);

		// Assert
		expect(maxActive).toBe(1);
	});

	test("preserves call order", async () => {
		// Arrange
		const lock = new AsyncLock();
		const order: number[] = [];

		// Act
		await Promise.all([
			lock.run(async () => {
				order.push(1);
			}),
			lock.run(async () => {
				order.push(2);
			}),
			lock.run(async () => {
				order.push(3);
			}),
		]);

		// Assert
		expect(order).toEqual([1, 2, 3]);
	});

	test("a rejected task doesn't wedge the queue for tasks queued after it", async () => {
		// Arrange
		const lock = new AsyncLock();
		const failing = lock.run(async () => {
			throw new Error("boom");
		});
		const following = lock.run(async () => "ok");

		// Act & Assert
		await expect(failing).rejects.toThrow("boom");
		await expect(following).resolves.toBe("ok");
	});

	test("propagates each task's own return value to its own caller", async () => {
		// Arrange
		const lock = new AsyncLock();

		// Act
		const [a, b] = await Promise.all([
			lock.run(async () => "a"),
			lock.run(async () => "b"),
		]);

		// Assert
		expect(a).toBe("a");
		expect(b).toBe("b");
	});
});
