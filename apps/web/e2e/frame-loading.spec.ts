import { expect, test } from "@playwright/test";

// Through Caddy (see playwright.config.ts), not straight to Bun's own port.
const API_BASE = "http://localhost:8080/api";

test.describe("Frame loading — lazy load and background stagger", () => {
  test("a lazyLoad service's iframe gets no src until it's opened", async ({ page, request }) => {
    // Arrange: seed a lazyLoad service in the default workspace.
    const created = await request.post(`${API_BASE}/services`, {
      data: {
        name: "Lazy Service",
        mark: "LZ",
        hue: "lavender",
        host: "example.com",
        url: "https://example.com",
        ws: "default",
        lazyLoad: true,
      },
    });
    expect(created.ok()).toBeTruthy();
    const body = await created.json();

    try {
      await page.goto("/");
      await page.reload();

      const lazyFrame = page.locator(
        `[data-testid="service-iframe"][data-service-id="${body.id}"]`,
      );
      // Assert: the iframe element exists (still mounted up front like every other
      // embeddable service) but has never been given a real src.
      await expect(lazyFrame).toHaveCount(1);
      await expect(lazyFrame).not.toHaveAttribute("src");

      // Act: open it from the sidebar.
      await page.getByTestId("sidebar-service-row").filter({ hasText: "Lazy Service" }).click();

      // Assert: opening it explicitly starts the load immediately, bypassing any queue.
      await expect(lazyFrame).toHaveAttribute("src", body.url);
    } finally {
      await request.delete(`${API_BASE}/services/${body.id}`);
    }
  });

  test("background preloading never starts more than maxParallelFrameLoads iframes at once", async ({
    page,
    request,
  }) => {
    // Arrange: seed more eager services than the default cap (3) in a fresh workspace, so
    // none of them is the initially-active service (which always jumps the queue).
    const workspace = await request.post(`${API_BASE}/workspaces`, {
      data: { name: "Stagger", label: "ST" },
    });
    expect(workspace.ok()).toBeTruthy();
    const workspaceBody = await workspace.json();

    const created = await Promise.all(
      ["A", "B", "C", "D", "E"].map((label, i) =>
        request
          .post(`${API_BASE}/services`, {
            data: {
              name: `Stagger Service ${label}`,
              mark: `S${i}`,
              hue: "sky",
              host: `example${i}.test`,
              url: `https://example${i}.test`,
              ws: workspaceBody.id,
            },
          })
          .then((res) => res.json()),
      ),
    );

    try {
      await page.goto("/");
      await page.reload();

      // Assert: right after load, at most 3 of these background (never-activated,
      // non-active-workspace) services have been started, regardless of there being 5.
      const startedCount = await page.evaluate(
        (ids) =>
          ids.filter((id) => {
            const el = document.querySelector(
              `[data-testid="service-iframe"][data-service-id="${id}"]`,
            );
            return !!el?.getAttribute("src");
          }).length,
        created.map((service) => service.id),
      );
      expect(startedCount).toBeLessThanOrEqual(3);
    } finally {
      await Promise.all(
        created.map((service) => request.delete(`${API_BASE}/services/${service.id}`)),
      );
      await request.delete(`${API_BASE}/workspaces/${workspaceBody.id}`);
    }
  });
});
