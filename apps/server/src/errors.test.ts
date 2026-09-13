import { describe, expect, spyOn, test } from "bun:test";
import { Elysia, t } from "elysia";
import {
	BadRequestError,
	errorPlugin,
	InternalServerError,
	NotFoundError,
	UnprocessableEntityError,
} from "./errors";

describe("HttpError subclasses", () => {
	test("BadRequestError carries status 400 and a default message", () => {
		const error = new BadRequestError();
		expect(error.status).toBe(400);
		expect(error.message).toBe("Bad Request");
		expect(error.name).toBe("BadRequestError");
	});

	test("BadRequestError accepts a custom message", () => {
		const error = new BadRequestError("Unknown workspace id: bogus");
		expect(error.message).toBe("Unknown workspace id: bogus");
	});

	test("NotFoundError carries status 404 and a default message", () => {
		const error = new NotFoundError();
		expect(error.status).toBe(404);
		expect(error.message).toBe("Not Found");
	});

	test("UnprocessableEntityError carries status 422 and a default message", () => {
		const error = new UnprocessableEntityError();
		expect(error.status).toBe(422);
		expect(error.message).toBe("Unprocessable Entity");
	});

	test("InternalServerError carries status 500 and a default message", () => {
		const error = new InternalServerError();
		expect(error.status).toBe(500);
		expect(error.message).toBe("Internal Server Error");
	});
});

describe("errorPlugin", () => {
	const app = new Elysia()
		.use(errorPlugin)
		.get("/http-error", () => {
			throw new NotFoundError("Widget not found");
		})
		.get("/generic-error", () => {
			throw new Error("boom — leaks internal detail");
		})
		.post("/validated", ({ body }) => body, {
			body: t.Object({ name: t.String() }),
		});

	test("maps a thrown HttpError to its own status and message", async () => {
		// Act
		const response = await app.handle(
			new Request("http://localhost/http-error"),
		);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(404);
		expect(body).toEqual({ message: "Widget not found" });
	});

	test("maps an unexpected error to a 500 without leaking its message, while still logging it", async () => {
		// Arrange
		const consoleError = spyOn(console, "error").mockImplementation(() => {});

		// Act
		const response = await app.handle(
			new Request("http://localhost/generic-error"),
		);
		const body = await response.json();

		// Assert
		expect(response.status).toBe(500);
		expect(body).toEqual({ message: "Internal Server Error" });
		expect(consoleError).toHaveBeenCalled();
		consoleError.mockRestore();
	});

	test("passes an Elysia request-validation failure through with its own status/message", async () => {
		// Act — missing the required `name` field
		const response = await app.handle(
			new Request("http://localhost/validated", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({}),
			}),
		);
		const body = (await response.json()) as { message: string };

		// Assert — never masked as a generic 500
		expect(response.status).not.toBe(500);
		expect(response.status).toBeGreaterThanOrEqual(400);
		expect(typeof body.message).toBe("string");
	});
});
