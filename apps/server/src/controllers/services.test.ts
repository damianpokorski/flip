import { beforeEach, describe, expect, mock, test } from "bun:test";

const getAllMock = mock();
const getByIdMock = mock();
const createMock = mock();
const updateMock = mock();
const deleteMock = mock();
const reorderMock = mock();
const readRawMock = mock();
const allServiceMocks = [
  getAllMock,
  getByIdMock,
  createMock,
  updateMock,
  deleteMock,
  reorderMock,
  readRawMock,
];

// Must run before the controller is imported: it builds `new ServicesService(...)` and
// `new HealthCheckService(...)` at module scope, so all collaborators need to be faked first.
mock.module("../services/ServicesService", () => ({
  ServicesService: class {
    getAll = getAllMock;
    getById = getByIdMock;
    create = createMock;
    update = updateMock;
    delete = deleteMock;
    reorder = reorderMock;
    readRaw = readRawMock;
  },
}));
mock.module("../db/ServicesRepository", () => ({
  ServicesRepository: class {},
}));
mock.module("../db/WorkspacesRepository", () => ({
  WorkspacesRepository: class {},
}));
mock.module("../services/HealthCheckService", () => ({
  HealthCheckService: class {
    getStatus() {
      return { ms: null, lastCheckedAt: null, bucket: "down" };
    }
    start() {}
    stop() {}
  },
}));
mock.module("../services/ProbeService", () => ({
  ProbeService: class {
    probe = mock();
  },
}));

const { servicesController } = await import("./services");
const { NotFoundError, BadRequestError } = await import("../errors");

const sampleService = {
  id: "1",
  name: "Example",
  mark: "EX",
  hue: "sapphire",
  host: "example.com",
  url: "https://example.com",
  healthCheckUrl: null,
  source: "external",
  localSlug: null,
  ws: "default",
  pin: null,
  codes: "200",
  every: "30s",
  target: "frame",
  proxyHeaders: false,
  hidden: false,
  lazyLoad: false,
  health: { ms: null, lastCheckedAt: null, bucket: "down" },
};

beforeEach(() => {
  for (const m of allServiceMocks) m.mockReset();
});

describe("GET /services", () => {
  test("returns all services from the service layer", async () => {
    // Arrange
    getAllMock.mockResolvedValue([sampleService]);

    // Act
    const response = await servicesController.handle(new Request("http://localhost/services"));
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(body).toEqual([sampleService]);
  });
});

describe("GET /services/:id", () => {
  test("returns the service when found", async () => {
    // Arrange
    getByIdMock.mockResolvedValue(sampleService);

    // Act
    const response = await servicesController.handle(new Request("http://localhost/services/1"));
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(body).toEqual(sampleService);
    expect(getByIdMock).toHaveBeenCalledWith("1");
  });

  test("maps NotFoundError to a 404 with a message body", async () => {
    // Arrange
    getByIdMock.mockRejectedValue(new NotFoundError("Service not found"));

    // Act
    const response = await servicesController.handle(
      new Request("http://localhost/services/missing"),
    );
    const body = await response.json();

    // Assert
    expect(response.status).toBe(404);
    expect(body).toEqual({ message: "Service not found" });
  });
});

describe("POST /services", () => {
  test("passes the body through to the service and returns the created service", async () => {
    // Arrange
    createMock.mockResolvedValue(sampleService);
    const requestBody = {
      name: "Example",
      mark: "EX",
      hue: "sapphire",
      host: "example.com",
      url: "https://example.com",
      ws: "default",
    };

    // Act
    const response = await servicesController.handle(
      new Request("http://localhost/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      }),
    );
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(body).toEqual(sampleService);
    expect(createMock).toHaveBeenCalledWith(expect.objectContaining(requestBody));
  });

  test("maps BadRequestError (e.g. unknown workspace id) to a 400", async () => {
    // Arrange
    createMock.mockRejectedValue(new BadRequestError("Unknown workspace id: bogus"));

    // Act
    const response = await servicesController.handle(
      new Request("http://localhost/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Example",
          mark: "EX",
          hue: "sapphire",
          host: "example.com",
          url: "https://example.com",
          ws: "bogus",
        }),
      }),
    );
    const body = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(body).toEqual({ message: "Unknown workspace id: bogus" });
  });
});

describe("DELETE /services/:id", () => {
  test("deletes and returns the service", async () => {
    // Arrange
    deleteMock.mockResolvedValue(sampleService);

    // Act
    const response = await servicesController.handle(
      new Request("http://localhost/services/1", { method: "DELETE" }),
    );
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(body).toEqual(sampleService);
  });
});

describe("PATCH /services/reorder", () => {
  test("reorders and returns the service list", async () => {
    // Arrange
    reorderMock.mockResolvedValue([sampleService]);

    // Act
    const response = await servicesController.handle(
      new Request("http://localhost/services/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: ["1"] }),
      }),
    );
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(body).toEqual([sampleService]);
    expect(reorderMock).toHaveBeenCalledWith(["1"]);
  });
});

describe("GET /services/raw", () => {
  test("returns the raw file text", async () => {
    // Arrange
    readRawMock.mockResolvedValue({
      content: "- id: 1\n",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    // Act
    const response = await servicesController.handle(new Request("http://localhost/services/raw"));
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(body).toEqual({
      content: "- id: 1\n",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
  });
});
