import { describe, expect, test } from "bun:test";
import { ServiceSchema } from "./service";

const baseService = {
	id: "1",
	name: "Example",
	mark: "EX",
	hue: "sapphire" as const,
	host: "example.com",
	url: "https://example.com",
	ws: "default",
	position: 0,
};

describe("ServiceSchema", () => {
	test("accepts a minimal external service and fills in defaults", () => {
		// Act
		const result = ServiceSchema.parse(baseService);

		// Assert
		expect(result.source).toBe("external");
		expect(result.localSlug).toBeNull();
		expect(result.codes).toBe("200");
		expect(result.every).toBe("30s");
		expect(result.target).toBe("frame");
		expect(result.proxyHeaders).toBe(false);
	});

	test("rejects source: external with a non-URL `url`", () => {
		// Act
		const result = ServiceSchema.safeParse({
			...baseService,
			source: "external",
			url: "not-a-url",
		});

		// Assert
		expect(result.success).toBe(false);
	});

	test("rejects source: local without a localSlug", () => {
		// Act
		const result = ServiceSchema.safeParse({
			...baseService,
			source: "local",
			url: "/api/sites/demo/",
			localSlug: null,
		});

		// Assert
		expect(result.success).toBe(false);
	});

	test("accepts source: local with a localSlug, without requiring `url` to be an absolute URL", () => {
		// Act
		const result = ServiceSchema.safeParse({
			...baseService,
			source: "local",
			url: "/api/sites/demo/",
			localSlug: "demo",
		});

		// Assert
		expect(result.success).toBe(true);
	});

	test("rejects a mark that isn't exactly 2 uppercase letters/digits", () => {
		expect(
			ServiceSchema.safeParse({ ...baseService, mark: "ex" }).success,
		).toBe(false);
		expect(
			ServiceSchema.safeParse({ ...baseService, mark: "EXX" }).success,
		).toBe(false);
	});

	test("rejects a codes string that isn't comma-separated 3-digit codes", () => {
		expect(
			ServiceSchema.safeParse({ ...baseService, codes: "200,abc" }).success,
		).toBe(false);
	});

	test("rejects an every string with no unit", () => {
		expect(
			ServiceSchema.safeParse({ ...baseService, every: "30" }).success,
		).toBe(false);
	});
});
