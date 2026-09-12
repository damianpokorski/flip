import { Elysia, t } from "elysia";
import { ServicesRepository } from "../db/ServicesRepository";
import { SitesRepository } from "../db/SitesRepository";
import { errorPlugin } from "../errors";
import { SitesService } from "../services/SitesService";

const SiteModel = t.Object({
	slug: t.String(),
	inUse: t.Boolean(),
});

const models = {
	Site: SiteModel,
	SiteList: t.Array(SiteModel),
};

const repository = new SitesRepository();
const servicesRepository = new ServicesRepository();
const service = new SitesService(repository, servicesRepository);

export const sitesController = new Elysia({ prefix: "/sites" })
	.use(errorPlugin)
	.model(models)
	.get("/", () => service.listAvailable(), {
		response: "SiteList",
		detail: {
			summary: "List folders available under DATA_DIR/sites",
			tags: ["sites"],
		},
	})
	// Raw file content, not JSON — this is what a local-source service's iframe points at.
	.get(
		"/:slug/*",
		async ({ params }) =>
			Bun.file(await service.getFile(params.slug, params["*"])),
		{
			// Elysia auto-derives a "*" param for the trailing wildcard segment — it must be
			// declared here too (t.Object defaults to additionalProperties: false) even though
			// including it also makes Elysia log a one-time "exactMirror" internal warning when
			// merging the wildcard's own inferred schema with this explicit one; harmless, but
			// don't "fix" it by dropping the field — that instead makes real requests 422.
			params: t.Object({ slug: t.String(), "*": t.String() }),
			detail: {
				summary: "Serve a file from a locally-hosted static site",
				tags: ["sites"],
			},
		},
	);
