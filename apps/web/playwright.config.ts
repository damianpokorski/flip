import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";
import { E2E_DATA_DIR } from "./e2e/data-dir";

const webDir = fileURLToPath(new URL(".", import.meta.url));
const serverDir = `${webDir}../server`;

// Playwright starts `webServer` entries concurrently with (not after) any `globalSetup`, so
// seeding the disposable data dir out-of-band would race the server's own startup. Instead,
// the server's own command wipes + bootstraps before it ever calls `.listen()` — the `url`
// readiness check then only succeeds once that's genuinely done, no race possible.
const serverCommand = [
	`rm -rf ${E2E_DATA_DIR}`,
	"bun run ../bootstrap/src/index.ts",
	"bun run --hot src/index.ts",
].join(" && ");

export default defineConfig({
	testDir: "./e2e",
	// The disposable data dir is a single shared set of YAML files for the whole run — keep
	// specs serial so they can't race each other on the same files.
	workers: 1,
	fullyParallel: false,
	retries: 0,
	reporter: "list",
	use: {
		baseURL: "http://localhost:5173",
		trace: "retain-on-failure",
	},
	projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
	webServer: [
		{
			command: serverCommand,
			cwd: serverDir,
			url: "http://localhost:3000/api/health",
			reuseExistingServer: false,
			env: {
				DATA_DIR: E2E_DATA_DIR,
			},
			stdout: "pipe",
			stderr: "pipe",
		},
		{
			command: "bun run dev",
			cwd: webDir,
			url: "http://localhost:5173",
			reuseExistingServer: false,
			stdout: "pipe",
			stderr: "pipe",
		},
	],
});
