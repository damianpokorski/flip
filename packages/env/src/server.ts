import path from "node:path";
import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

// Anchored to this file's location (not the caller's cwd), so it resolves to the same
// place whether invoked from a workspace subdirectory in dev or from the Docker image
// root — repo-root/data in dev, overridden to /data in the Docker image.
const DEFAULT_DATA_DIR = path.resolve(import.meta.dir, "../../../data");

export const env = createEnv({
	server: {
		DATA_DIR: z.string().default(DEFAULT_DATA_DIR),
		CORS_ORIGIN: z.url().default("http://localhost:5173"),
		NODE_ENV: z
			.enum(["development", "production", "test"])
			.default("development"),
		PORT: z.coerce.number().int().positive().default(3000),
		HEALTH_CHECK_INTERVAL_MS: z.coerce
			.number()
			.int()
			.positive()
			.default(30_000),
		HEALTH_CHECK_TIMEOUT_MS: z.coerce.number().int().positive().default(5_000),
	},
	runtimeEnv: process.env,
	skipValidation: !!process.env.SKIP_ENV_VALIDATION,
	emptyStringAsUndefined: true,
});
