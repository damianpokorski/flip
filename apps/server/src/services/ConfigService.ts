import { env } from "@flip/env/server";
import type { Config } from "@flip/store";
import type { ConfigRepository } from "../db/ConfigRepository";
import { resolveProxyPort } from "./CaddyProxyService";

export class ConfigService {
	constructor(private readonly repo: ConfigRepository) {}

	async get() {
		return this.enrich(await this.repo.get());
	}

	async update(patch: Pick<Config, "theme">) {
		return this.enrich(await this.repo.update(patch));
	}

	readRaw(): Promise<{ content: string; updatedAt: string }> {
		return this.repo.readRaw();
	}

	// Drops proxySecret — it's an HMAC key for proxy subdomain labels, never meant to leave the
	// server (the raw config.yaml view under Settings → Config is the one place it's visible).
	private enrich(config: Config) {
		const { proxySecret: _proxySecret, ...rest } = config;
		return {
			...rest,
			proxyDomain: env.PROXY_DOMAIN ?? null,
			proxyPort: resolveProxyPort(
				env.NODE_ENV === "production" ? "prod" : "dev",
			),
		};
	}
}
