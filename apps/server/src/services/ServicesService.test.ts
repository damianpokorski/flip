import { beforeEach, describe, expect, mock, test } from "bun:test";
import { BadRequestError } from "../errors";
import { ServicesService } from "./ServicesService";

function fakeServicesRepo() {
  return {
    findAll: mock(async () => []),
    create: mock(async (data: unknown) => ({
      ...(data as object),
      position: 0,
    })),
    update: mock(async (_id: string, data: unknown) => ({
      ...(data as object),
    })),
  };
}

function fakeWorkspacesRepo() {
  return { findById: mock(async () => ({ id: "default" })) };
}

const baseBody = {
  name: "Example",
  mark: "EX",
  hue: "sapphire" as const,
  host: "example.com",
  url: "https://example.com",
  ws: "default",
};

describe("ServicesService local-source derivation", () => {
  let servicesRepo: ReturnType<typeof fakeServicesRepo>;
  let workspacesRepo: ReturnType<typeof fakeWorkspacesRepo>;
  let service: ServicesService;

  beforeEach(() => {
    servicesRepo = fakeServicesRepo();
    workspacesRepo = fakeWorkspacesRepo();
    // biome-ignore lint/suspicious/noExplicitAny: fakes intentionally implement a subset
    service = new ServicesService(servicesRepo as any, workspacesRepo as any);
  });

  test("derives url from localSlug and forces proxyHeaders off for source: local", async () => {
    // Arrange
    const body = { ...baseBody, source: "local" as const, localSlug: "demo" };

    // Act
    await service.create(body);

    // Assert
    expect(servicesRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "local",
        localSlug: "demo",
        url: "/api/sites/demo/",
        proxyHeaders: false,
      }),
    );
  });

  test("throws BadRequestError when source is local but localSlug is missing", async () => {
    // Arrange
    const body = { ...baseBody, source: "local" as const, localSlug: null };

    // Act & Assert
    await expect(service.create(body)).rejects.toThrow(BadRequestError);
    expect(servicesRepo.create).not.toHaveBeenCalled();
  });

  test("clears localSlug and leaves url untouched for source: external", async () => {
    // Arrange
    const body = {
      ...baseBody,
      source: "external" as const,
      localSlug: "stale",
    };

    // Act
    await service.create(body);

    // Assert
    expect(servicesRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "external",
        localSlug: null,
        url: "https://example.com",
      }),
    );
  });
});
