import { describe, expect, test } from "bun:test";
import { renderSeedPage, sanitizeNext } from "./seed-page";

describe("sanitizeNext", () => {
	test("keeps a same-origin path with its query and hash", () => {
		// Act
		const next = sanitizeNext("/lovelace/0?edit=1#top");

		// Assert
		expect(next).toBe("/lovelace/0?edit=1#top");
	});

	test("falls back to / when missing or not path-absolute", () => {
		// Act
		const results = [
			sanitizeNext(undefined),
			sanitizeNext(""),
			sanitizeNext("lovelace"),
			sanitizeNext("http://evil.example/"),
		];

		// Assert
		expect(results).toEqual(["/", "/", "/", "/"]);
	});

	test("refuses anything that resolves to another origin", () => {
		// Act
		const results = [
			sanitizeNext("//evil.example/"),
			sanitizeNext("/\\evil.example/"),
			sanitizeNext("/\t/evil.example/"),
		];

		// Assert
		expect(results).toEqual(["/", "/", "/"]);
	});
});

describe("renderSeedPage", () => {
	test("serves uncached HTML that writes each localStorage row, then redirects to next", async () => {
		// Arrange
		const injections = [
			{
				kind: "localStorage" as const,
				key: "dockedSidebar",
				value: '"always_hidden"',
			},
		];

		// Act
		const response = renderSeedPage(injections, "/lovelace");
		const html = await response.text();

		// Assert
		expect(response.headers.get("Content-Type")).toBe(
			"text/html; charset=utf-8",
		);
		expect(response.headers.get("Cache-Control")).toBe("no-store");
		expect(html).toContain(
			'"storage":[["dockedSidebar","\\"always_hidden\\""]]',
		);
		expect(html).toContain('"next":"/lovelace"');
		expect(html).toContain("location.replace(seed.next)");
	});

	test("escapes a value that would otherwise close the inline script", async () => {
		// Arrange
		const injections = [
			{
				kind: "localStorage" as const,
				key: "k",
				value: "</script><script>alert(1)</script>",
			},
		];

		// Act
		const html = await renderSeedPage(injections, "/").text();

		// Assert
		expect(html.match(/<\/script>/g)).toHaveLength(1);
		expect(html).toContain("\\u003c/script>");
	});

	test("sends one Set-Cookie per cookie row, defaulting Path to /", () => {
		// Arrange
		const injections = [
			{ kind: "cookie" as const, key: "a", value: "1" },
			{ kind: "cookie" as const, key: "b", value: "2; path=/app; HttpOnly" },
			{ kind: "localStorage" as const, key: "c", value: "3" },
		];

		// Act
		const response = renderSeedPage(injections, "/");

		// Assert
		expect(response.headers.getSetCookie()).toEqual([
			"a=1; Path=/",
			"b=2; path=/app; HttpOnly",
		]);
	});

	test("ignores header and query rows", async () => {
		// Arrange
		const injections = [
			{ kind: "requestHeader" as const, key: "X-User", value: "me" },
			{ kind: "query" as const, key: "kiosk", value: "" },
		];

		// Act
		const response = renderSeedPage(injections, "/");
		const html = await response.text();

		// Assert
		expect(response.headers.getSetCookie()).toEqual([]);
		expect(html).toContain('"storage":[]');
	});
});
