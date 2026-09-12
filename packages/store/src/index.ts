export * from "./codes";
export { configStore } from "./config";
export { dataDir } from "./fs-yaml";
export * from "./health-bucket";
export * from "./interval";
export * from "./schemas/config";
export * from "./schemas/service";
export * from "./schemas/workspace";
export type { NewService, ServicePatch } from "./services";
export { servicesStore } from "./services";
export * from "./sites";
export type { NewWorkspace, WorkspacePatch } from "./workspaces";
export { workspacesStore } from "./workspaces";

import { mkdir } from "node:fs/promises";
import { configStore } from "./config";
import { servicesStore } from "./services";
import { sitesDir } from "./sites";
import { workspacesStore } from "./workspaces";

// Ensures DATA_DIR and its default YAML files exist. Safe to call on every boot — purely
// additive, never overwrites an existing file. Shared by apps/bootstrap (the Docker/
// production startup step) and apps/server (a boot-time safety net for local dev), so both
// environments are guaranteed to end up with the same data files.
export async function initDataFiles(): Promise<void> {
  await servicesStore.ensureExists();
  await workspacesStore.ensureExists();
  await configStore.ensureExists();
  // Not a YAML "file" like the above — just makes DATA_DIR/sites/ exist so it's ready as a
  // volume-mount target for locally-hosted static sites from the very first boot.
  await mkdir(sitesDir(), { recursive: true });
}
