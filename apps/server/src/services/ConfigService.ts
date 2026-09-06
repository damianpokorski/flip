import { env } from "@flip/env/server";
import type { ConfigRepository } from "../db/ConfigRepository";

export class ConfigService {
	constructor(private readonly repo: ConfigRepository) {}

	async get() {
		const config = await this.repo.get();
		return {
			...config,
			proxyDomain: env.PROXY_DOMAIN ?? null,
			proxyPort: env.PROXY_PORT,
		};
	}

	readRaw(): Promise<{ content: string; updatedAt: string }> {
		return this.repo.readRaw();
	}
}
