import { describe, expect, test } from "bun:test";
import { parseEvery } from "./interval";

describe("parseEvery", () => {
	test("parses milliseconds", () => {
		expect(parseEvery("500ms")).toBe(500);
	});

	test("parses seconds", () => {
		expect(parseEvery("30s")).toBe(30_000);
	});

	test("parses minutes", () => {
		expect(parseEvery("5m")).toBe(300_000);
	});

	test("parses hours", () => {
		expect(parseEvery("2h")).toBe(7_200_000);
	});

	test("trims surrounding whitespace", () => {
		expect(parseEvery(" 30s ")).toBe(30_000);
	});

	test("throws on a missing unit", () => {
		expect(() => parseEvery("30")).toThrow('Invalid interval string: "30"');
	});

	test("throws on an unrecognized unit", () => {
		expect(() => parseEvery("30d")).toThrow();
	});

	test("throws on garbage input", () => {
		expect(() => parseEvery("soon")).toThrow();
	});
});
