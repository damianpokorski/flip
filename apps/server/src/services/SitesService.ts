import type { ServicesRepository } from "../db/ServicesRepository";
import type { SitesRepository } from "../db/SitesRepository";
import { NotFoundError } from "../errors";

export class SitesService {
  constructor(
    private readonly repo: SitesRepository,
    private readonly services: ServicesRepository,
  ) {}

  // Lists every folder under DATA_DIR/sites/, flagging which ones are already claimed by a
  // service — the Settings UI folder-picker uses `inUse` to steer away from double-mounting
  // the same folder onto two tiles, without hard-blocking it server-side.
  async listAvailable(): Promise<{ slug: string; inUse: boolean }[]> {
    const [slugs, services] = await Promise.all([this.repo.listSlugs(), this.services.findAll()]);
    const claimed = new Set(
      services
        .filter((service) => service.source === "local" && service.localSlug)
        .map((service) => service.localSlug),
    );
    return slugs.map((slug) => ({ slug, inUse: claimed.has(slug) }));
  }

  async getFile(slug: string, subpath: string): Promise<string> {
    const resolved = this.repo.resolveFile(slug, subpath);
    if (!resolved || !(await Bun.file(resolved).exists())) {
      throw new NotFoundError("Site file not found");
    }
    return resolved;
  }
}
