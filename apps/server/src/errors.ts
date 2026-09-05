import { Elysia, t } from "elysia";

export abstract class HttpError extends Error {
	constructor(
		public readonly status: number,
		message: string,
	) {
		super(message);
		this.name = this.constructor.name;
	}
}

export class BadRequestError extends HttpError {
	constructor(message = "Bad Request") {
		super(400, message);
	}
}

export class NotFoundError extends HttpError {
	constructor(message = "Not Found") {
		super(404, message);
	}
}

export class UnprocessableEntityError extends HttpError {
	constructor(message = "Unprocessable Entity") {
		super(422, message);
	}
}

export class InternalServerError extends HttpError {
	constructor(message = "Internal Server Error") {
		super(500, message);
	}
}

export const errorModels = {
	BadRequestError: t.Object(
		{ message: t.String() },
		{ description: "The request was malformed or invalid" },
	),
	NotFoundError: t.Object(
		{ message: t.String() },
		{ description: "The requested resource was not found" },
	),
	UnprocessableEntityError: t.Object(
		{ message: t.String() },
		{ description: "The request was well-formed but contains semantic errors" },
	),
	InternalServerError: t.Object(
		{ message: t.String() },
		{ description: "An unexpected error occurred on the server" },
	),
};

export const errorPlugin = new Elysia({ name: "error-plugin" })
	.model(errorModels)
	.error({
		BadRequestError,
		NotFoundError,
		UnprocessableEntityError,
		InternalServerError,
	})
	.onError({ as: "global" }, ({ error, code, set }) => {
		if (error instanceof HttpError) {
			set.status = error.status;
			return { message: error.message };
		}
		// Elysia's own request-validation failures (bad body/query/params against a
		// route's TypeBox schema) already carry the correct status (422) and a useful
		// message — pass them through as-is instead of masking them as a 500 below.
		if (code === "VALIDATION") {
			set.status = error.status;
			return { message: error.message };
		}
		// Unexpected (non-HttpError, non-validation) failures: log the full error
		// server-side, but don't leak internal details to the client.
		console.error(error);
		set.status = 500;
		return { message: "Internal Server Error" };
	});
