import { fileURLToPath } from "node:url";

// Absolute path so both the Playwright config's webServer process (cwd: apps/server) and
// the bootstrap invocation resolve to the exact same directory, regardless of relative-path
// quirks between working directories.
const e2eDir = fileURLToPath(new URL(".", import.meta.url));

export const E2E_DATA_DIR = `${e2eDir}.e2e-data`;
