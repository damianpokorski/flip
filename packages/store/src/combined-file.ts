import { type Document, isSeq } from "yaml";
import { DEFAULT_CONFIG_YAML } from "./defaults";
import { YamlFile } from "./fs-yaml";
import { type CombinedConfig, CombinedConfigSchema } from "./schemas/config";

// The single file backing servicesStore/workspacesStore/configStore — one lock, one atomic
// write, so a cascade touching both a workspace and its services (see
// workspacesStore.deleteWithCascade) can never leave the two halves inconsistent on disk.
export const combinedConfigFile = new YamlFile<CombinedConfig>(
	"config.yaml",
	CombinedConfigSchema,
	DEFAULT_CONFIG_YAML,
	{ migrateNewDefaultsOnBoot: true },
);

export function findWorkspaceIndex(doc: Document, workspaceId: string): number {
	const data = doc.toJS() as CombinedConfig | undefined;
	return (data?.workspaces ?? []).findIndex((w) => w.id === workspaceId);
}

export interface ServiceLocation {
	wsIndex: number;
	svcIndex: number;
	workspaceId: string;
}

export function findServiceLocation(
	doc: Document,
	serviceId: string,
): ServiceLocation | undefined {
	const data = doc.toJS() as CombinedConfig | undefined;
	const workspaces = data?.workspaces ?? [];
	for (let wsIndex = 0; wsIndex < workspaces.length; wsIndex++) {
		// biome-ignore lint/style/noNonNullAssertion: wsIndex is within bounds by the loop condition
		const workspace = workspaces[wsIndex]!;
		const svcIndex = workspace.services.findIndex((s) => s.id === serviceId);
		if (svcIndex !== -1)
			return { wsIndex, svcIndex, workspaceId: workspace.id };
	}
	return undefined;
}

// Forces block style (one entry per line) on the seq node at `path` before appending/moving a
// node into it — a seq serialized from an empty array defaults to flow style (`services: []`),
// and yaml's Document API keeps that style when items are added to it in place, which would
// otherwise turn a workspace's first-ever service into an ugly inline block. A no-op on a seq
// that's already block-style (i.e. already had entries).
export function ensureBlockStyle(
	doc: Document,
	path: (string | number)[],
): void {
	const seq = doc.getIn(path, true);
	if (isSeq(seq)) seq.flow = false;
}
