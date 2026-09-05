export { configStore } from "./config";
export { dataDir } from "./fs-yaml";
export { type NewPanel, type PanelPatch, panelsStore } from "./panels";
export * from "./schemas/config";
export * from "./schemas/panels";

import { configStore } from "./config";
import { panelsStore } from "./panels";

// Ensures DATA_DIR and its default YAML files exist. Safe to call on every boot — purely
// additive, never overwrites an existing file. Shared by apps/bootstrap (the Docker/
// production startup step) and apps/server (a boot-time safety net for local dev), so both
// environments are guaranteed to end up with the same data files.
export async function initDataFiles(): Promise<void> {
	await panelsStore.ensureExists();
	await configStore.ensureExists();
}
