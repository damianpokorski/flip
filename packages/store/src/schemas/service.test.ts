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

describe("ServiceSchema inject", () => {
	test("defaults inject to an empty list", () => {
		// Act
		const result = ServiceSchema.parse(baseService);

		// Assert
		expect(result.inject).toEqual([]);
	});

	test("accepts one row of every kind", () => {
		// Arrange
		const inject = [
			{ kind: "requestHeader", key: "X-Forwarded-User", value: "me" },
			{ kind: "responseHeader", key: "X-Test", value: "1" },
			{ kind: "cookie", key: "session", value: "abc; HttpOnly" },
			{ kind: "query", key: "kiosk", value: "" },
			{ kind: "localStorage", key: "dockedSidebar", value: '"always_hidden"' },
		];

		// Act
		const result = ServiceSchema.safeParse({ ...baseService, inject });

		// Assert
		expect(result.success).toBe(true);
	});

	test("rejects a header name that isn't a valid HTTP token", () => {
		// Arrange
		const inject = [{ kind: "requestHeader", key: "X Bad", value: "1" }];

		// Act
		const result = ServiceSchema.safeParse({ ...baseService, inject });

		// Assert
		expect(result.success).toBe(false);
	});

	test("rejects overriding Host as a request header, case-insensitively", () => {
		// Arrange
		const inject = [{ kind: "requestHeader", key: "host", value: "evil" }];

		// Act
		const result = ServiceSchema.safeParse({ ...baseService, inject });

		// Assert
		expect(result.success).toBe(false);
	});

	test("rejects a line break in a value", () => {
		// Arrange
		const inject = [
			{ kind: "responseHeader", key: "X-Test", value: "1\nreverse_proxy x" },
		];

		// Act
		const result = ServiceSchema.safeParse({ ...baseService, inject });

		// Assert
		expect(result.success).toBe(false);
	});

	test("allows non-token keys for localStorage and query", () => {
		// Arrange
		const inject = [
			{ kind: "localStorage", key: "some key:with/odd chars", value: "1" },
			{ kind: "query", key: "a b", value: "1" },
		];

		// Act
		const result = ServiceSchema.safeParse({ ...baseService, inject });

		// Assert
		expect(result.success).toBe(true);
	});
});
