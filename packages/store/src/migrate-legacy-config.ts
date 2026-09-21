import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { Document, isMap, parseDocument, type YAMLMap, YAMLSeq } from "yaml";
import { DEFAULT_CONFIG_YAML } from "./defaults";
import { dataFilePath, getHeaderComment, setHeaderComment } from "./fs-yaml";
import { CombinedConfigSchema, ConfigSchema } from "./schemas/config";
import { LegacyServicesFileSchema } from "./schemas/service";
import { LegacyWorkspacesFileSchema } from "./schemas/workspace";

const SERVICES_PATH = () => dataFilePath("services.yaml");
const WORKSPACES_PATH = () => dataFilePath("workspaces.yaml");
const CONFIG_PATH = () => dataFilePath("config.yaml");

async function fileExists(path: string): Promise<boolean> {
	return Bun.file(path).exists();
}

async function deleteLegacyFilesIfPresent(): Promise<void> {
	await rm(SERVICES_PATH(), { force: true });
	await rm(WORKSPACES_PATH(), { force: true });
}

async function writeAtomic(path: string, text: string): Promise<void> {
	const tmpPath = `${path}.tmp-${process.pid}-${Date.now()}`;
	await writeFile(tmpPath, text, "utf8");
	await rename(tmpPath, path);
}

// One-time structural migration: folds legacy services.yaml/workspaces.yaml (a flat Service[]
// with a `ws` foreign key and a global `position`, and a flat Workspace[] with its own
// `position`) into the combined, nested config.yaml, then deletes the legacy files. Runs on
// every boot before combinedConfigFile.ensureExists(), but is a cheap no-op once migrated.
//
// Distinct from YamlFile's own migrateNewDefaultsOnBoot (which additively backfills new
// *scalar* top-level fields on every boot, forever): this only ever does real work once, the
// first time a pre-single-file install boots against this version. By the time this returns,
// config.yaml already has every field the current schema knows about, so
// migrateNewDefaultsOnBoot's backfill loop (which runs right after, via ensureExists()) finds
// nothing missing and leaves the freshly-migrated file untouched.
export async function migrateLegacyConfigIfNeeded(): Promise<void> {
	const [legacyServicesExists, legacyWorkspacesExists] = await Promise.all([
		fileExists(SERVICES_PATH()),
		fileExists(WORKSPACES_PATH()),
	]);

	if (!legacyServicesExists && !legacyWorkspacesExists) return;

	if (legacyServicesExists !== legacyWorkspacesExists) {
		// A genuinely unexpected state — both legacy files are always created together. Fail
		// loudly rather than guess: dropping every service (or inventing an empty workspace
		// list) would silently lose data.
		throw new Error(
			"[@flip/store] Found only one of services.yaml/workspaces.yaml on disk — this " +
				"shouldn't happen. Restore both from backup, or delete the remaining one, " +
				"before restarting.",
		);
	}

	const configExists = await fileExists(CONFIG_PATH());
	if (configExists) {
		const existingRaw = await readFile(CONFIG_PATH(), "utf8");
		const existingParsed = parseDocument(existingRaw).toJS();
		if (CombinedConfigSchema.safeParse(existingParsed).success) {
			// A previous run already wrote the combined file but crashed before deleting the
			// legacy ones — nothing left to merge, just finish the cleanup.
			await deleteLegacyFilesIfPresent();
			return;
		}
	}

	// Old flat config.yaml's scalar values (if any) carry forward; a fresh install with no
	// config.yaml at all just gets zod's defaults once CombinedConfigSchema.parse runs below.
	const scalarConfig = configExists
		? ConfigSchema.parse(
				parseDocument(await readFile(CONFIG_PATH(), "utf8")).toJS(),
			)
		: {};

	const legacyServicesText = await readFile(SERVICES_PATH(), "utf8");
	const legacyWorkspacesText = await readFile(WORKSPACES_PATH(), "utf8");
	// Validate the plain-JS shape up front — fail loudly on a malformed legacy file before
	// touching any raw nodes below.
	LegacyServicesFileSchema.parse(parseDocument(legacyServicesText).toJS());
	LegacyWorkspacesFileSchema.parse(parseDocument(legacyWorkspacesText).toJS());

	// From here on, operate on the raw parsed Document nodes (not the plain-JS shape above) —
	// re-nesting a service under its workspace's raw YAMLMap, rather than rebuilding a plain
	// object and re-serializing it, is what lets a hand-added comment on a specific service or
	// workspace entry survive this one-time structural move.
	const servicesSeq = parseDocument(legacyServicesText).contents as YAMLSeq;
	const workspacesSeq = parseDocument(legacyWorkspacesText).contents as YAMLSeq;

	const workspaceEntries = workspacesSeq.items.map((node) => {
		if (!isMap(node)) throw new Error("expected a workspace map node");
		const position = node.get("position") as number;
		const id = node.get("id") as string;
		node.delete("position");
		return { node: node as YAMLMap, id, position };
	});
	const serviceEntries = servicesSeq.items.map((node) => {
		if (!isMap(node)) throw new Error("expected a service map node");
		const position = node.get("position") as number;
		const ws = node.get("ws") as string;
		node.delete("position");
		node.delete("ws");
		return { node: node as YAMLMap, ws, position };
	});

	const sortedWorkspaces = [...workspaceEntries].sort(
		(a, b) => a.position - b.position,
	);
	for (const workspace of sortedWorkspaces) {
		const nestedServices = serviceEntries
			.filter((service) => service.ws === workspace.id)
			.sort((a, b) => a.position - b.position)
			.map((service) => service.node);
		const nestedSeq = new YAMLSeq();
		nestedSeq.items = nestedServices;
		nestedSeq.flow = false;
		workspace.node.set("services", nestedSeq);
	}
	workspacesSeq.items = sortedWorkspaces.map((workspace) => workspace.node);

	const doc = new Document(ConfigSchema.parse(scalarConfig));
	doc.set("workspaces", workspacesSeq);
	// Self-test before writing anything — a bug in this transform should fail boot loudly,
	// not silently produce a file the rest of the app can't read.
	CombinedConfigSchema.parse(doc.toJS());
	setHeaderComment(doc, getHeaderComment(parseDocument(DEFAULT_CONFIG_YAML)));
	await writeAtomic(CONFIG_PATH(), doc.toString());

	// Only delete the legacy files once the combined file has fully landed on disk.
	await deleteLegacyFilesIfPresent();
	console.log(
		"[@flip/store] migrated legacy services.yaml/workspaces.yaml into config.yaml",
	);
}
