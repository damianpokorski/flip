import { listSiteSlugs, resolveSiteFile } from "@flip/store";

// Thin wrapper over @flip/store's filesystem-backed accessors — no business logic here, that
// belongs in SitesService. Mirrors ServicesRepository's role for the YAML-backed resources.
export class SitesRepository {
	listSlugs(): Promise<string[]> {
		return listSiteSlugs();
	}

	resolveFile(slug: string, subpath: string): string | null {
		return resolveSiteFile(slug, subpath);
	}
}
