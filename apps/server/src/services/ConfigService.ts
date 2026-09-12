import { env } from "@flip/env/server";
import type { ConfigRepository } from "../db/ConfigRepository";
import { resolveProxyPort } from "./CaddyProxyService";

export class ConfigService {
	constructor(private readonly repo: ConfigRepository) {}

	async get() {
		const config = await this.repo.get();
		return {
			...config,
			proxyDomain: env.PROXY_DOMAIN ?? null,
			proxyPort: resolveProxyPort(
				env.NODE_ENV === "production" ? "prod" : "dev",
			),
		};
	}

	readRaw(): Promise<{ content: string; updatedAt: string }> {
		return this.repo.readRaw();
	}
}
