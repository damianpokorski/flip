import { describe, expect, test } from "bun:test";
import { NotFoundError } from "../errors";
import { SitesService } from "./SitesService";

function fakeSitesRepo(
  slugs: string[],
  resolveFile: (slug: string, subpath: string) => string | null = () => null,
) {
  return { listSlugs: async () => slugs, resolveFile };
}

function fakeServicesRepo(services: { source: string; localSlug: string | null }[]) {
  return { findAll: async () => services };
}

describe("SitesService.listAvailable", () => {
  test("flags slugs already claimed by a local-source service", async () => {
    // Arrange
    const sitesRepo = fakeSitesRepo(["demo", "blog"]);
    const servicesRepo = fakeServicesRepo([
      { source: "local", localSlug: "demo" },
      { source: "external", localSlug: null },
    ]);
    // biome-ignore lint/suspicious/noExplicitAny: fakes intentionally implement a subset
    const service = new SitesService(sitesRepo as any, servicesRepo as any);

    // Act
    const result = await service.listAvailable();

    // Assert
    expect(result).toEqual([
      { slug: "demo", inUse: true },
      { slug: "blog", inUse: false },
    ]);
  });
});

describe("SitesService.getFile", () => {
  test("throws NotFoundError when the repository can't resolve the path", async () => {
    // Arrange
    const sitesRepo = fakeSitesRepo([], () => null);
    // biome-ignore lint/suspicious/noExplicitAny: fakes intentionally implement a subset
    const service = new SitesService(sitesRepo as any, fakeServicesRepo([]) as any);

    // Act & Assert
    await expect(service.getFile("demo", "index.html")).rejects.toThrow(NotFoundError);
  });

  test("throws NotFoundError when the resolved file doesn't exist on disk", async () => {
    // Arrange — resolves to a path, but nothing is actually there
    const sitesRepo = fakeSitesRepo([], () => "/nonexistent/path/index.html");
    // biome-ignore lint/suspicious/noExplicitAny: fakes intentionally implement a subset
    const service = new SitesService(sitesRepo as any, fakeServicesRepo([]) as any);

    // Act & Assert
    await expect(service.getFile("demo", "index.html")).rejects.toThrow(NotFoundError);
  });
});
