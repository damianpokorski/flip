import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { ProbeService } from "./ProbeService";

const originalFetch = global.fetch;

function fakeResponse(init: {
  status?: number;
  headers?: Record<string, string>;
  body?: string;
  contentType?: string;
}): Response {
  const headers = new Headers(init.headers ?? {});
  if (init.contentType) headers.set("content-type", init.contentType);
  return new Response(init.body ?? "", { status: init.status ?? 200, headers });
}

describe("ProbeService", () => {
  let probeService: ProbeService;

  beforeEach(() => {
    probeService = new ProbeService();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test("reports embeddable when no framing headers are present", async () => {
    // Arrange
    global.fetch = (async () =>
      fakeResponse({
        status: 200,
        contentType: "text/html",
        body: "<html><head><title>NAS</title></head></html>",
      })) as unknown as typeof fetch;

    // Act
    const result = await probeService.probe("https://nas.home.lan");

    // Assert
    expect(result.embeddable).toBe(true);
    expect(result.suggestedTarget).toBe("frame");
    expect(result.title).toBe("NAS");
    expect(result.statusCode).toBe(200);
    expect(result.ms).toBeGreaterThanOrEqual(0);
  });

  test("reports not embeddable when X-Frame-Options refuses framing", async () => {
    // Arrange
    global.fetch = (async () =>
      fakeResponse({
        status: 200,
        headers: { "x-frame-options": "DENY" },
      })) as unknown as typeof fetch;

    // Act
    const result = await probeService.probe("https://example.com");

    // Assert
    expect(result.embeddable).toBe(false);
    expect(result.suggestedTarget).toBe("external");
  });

  test("reports not embeddable when CSP frame-ancestors is 'none'", async () => {
    // Arrange
    global.fetch = (async () =>
      fakeResponse({
        status: 200,
        headers: { "content-security-policy": "frame-ancestors 'none'" },
      })) as unknown as typeof fetch;

    // Act
    const result = await probeService.probe("https://example.com");

    // Assert
    expect(result.embeddable).toBe(false);
  });

  test("returns a down-shaped result when the fetch fails", async () => {
    // Arrange
    global.fetch = (async () => {
      throw new Error("network error");
    }) as unknown as typeof fetch;

    // Act
    const result = await probeService.probe("https://unreachable.invalid");

    // Assert
    expect(result.ms).toBeNull();
    expect(result.statusCode).toBeNull();
    expect(result.embeddable).toBe(false);
    expect(result.suggestedTarget).toBe("external");
  });

  test("skips title parsing for non-HTML responses", async () => {
    // Arrange
    global.fetch = (async () =>
      fakeResponse({
        status: 200,
        contentType: "application/json",
        body: "{}",
      })) as unknown as typeof fetch;

    // Act
    const result = await probeService.probe("https://api.home.lan");

    // Assert
    expect(result.title).toBeNull();
  });
});
