import { describe, expect, test } from "bun:test";
import { bucketFor } from "./health-bucket";

describe("bucketFor", () => {
	test("null counts as down", () => {
		expect(bucketFor(null)).toBe("down");
	});

	test("0ms is fast", () => {
		expect(bucketFor(0)).toBe("fast");
	});

	test("59ms is fast (just under the fast/ok boundary)", () => {
		expect(bucketFor(59)).toBe("fast");
	});

	test("60ms is ok (the fast/ok boundary)", () => {
		expect(bucketFor(60)).toBe("ok");
	});

	test("249ms is ok (just under the ok/slow boundary)", () => {
		expect(bucketFor(249)).toBe("ok");
	});

	test("250ms is slow (the ok/slow boundary)", () => {
		expect(bucketFor(250)).toBe("slow");
	});

	test("a very large latency is still slow, not down", () => {
		expect(bucketFor(60_000)).toBe("slow");
	});
});
