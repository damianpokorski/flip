import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const listAvailableMock = mock();
const getFileMock = mock();
const allSiteMocks = [listAvailableMock, getFileMock];

// Must run before the controller is imported: it builds `new SitesService(...)` at module
// scope, so all collaborators need to be faked first.
mock.module("../services/SitesService", () => ({
	SitesService: class {
		listAvailable = listAvailableMock;
		getFile = getFileMock;
	},
}));
mock.module("../db/SitesRepository", () => ({
	SitesRepository: class {},
}));
mock.module("../db/ServicesRepository", () => ({
	ServicesRepository: class {},
}));

const { sitesController } = await import("./sites");
const { NotFoundError } = await import("../errors");

beforeEach(() => {
	for (const m of allSiteMocks) m.mockReset();
});

describe("GET /sites", () => {
	test("returns the available folder list from the service layer", async () => {
		// Arrange
		listAvailableMock.mockResolvedValue([
			{ slug: "demo", inUse: false },
			{ slug: "blog", inUse: true },
		]);

		// Act
		const response = await sitesController.handle(
			new Request("http://localhost/sites"),
		);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(200);
		expect(body).toEqual([
			{ slug: "demo", inUse: false },
			{ slug: "blog", inUse: true },
		]);
	});
});

describe("GET /sites/:slug/*", () => {
	let dir: string;

	beforeEach(async () => {
		dir = await mkdtemp(path.join(tmpdir(), "flip-sites-test-"));
	});

	afterEach(async () => {
		await rm(dir, { recursive: true, force: true });
	});

	test("serves the resolved file's content", async () => {
		// Arrange
		const filePath = path.join(dir, "index.html");
		await writeFile(filePath, "<h1>hello</h1>", "utf8");
		getFileMock.mockResolvedValue(filePath);

		// Act
		const response = await sitesController.handle(
			new Request("http://localhost/sites/demo/index.html"),
		);
		const body = await response.text();

		// Assert
		expect(response.status).toBe(200);
		expect(body).toBe("<h1>hello</h1>");
		expect(getFileMock).toHaveBeenCalledWith("demo", "index.html");
	});

	test("maps NotFoundError to a 404 with a message body", async () => {
		// Arrange
		getFileMock.mockRejectedValue(new NotFoundError("Site file not found"));

		// Act
		const response = await sitesController.handle(
			new Request("http://localhost/sites/demo/missing.html"),
		);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(404);
		expect(body).toEqual({ message: "Site file not found" });
	});
});
