import type { Config, ConfigRepository } from "../db/ConfigRepository";
import { notifyDataChanged } from "../events";

export class ConfigService {
	constructor(private readonly repo: ConfigRepository) {}

	get(): Promise<Config> {
		return this.repo.get();
	}

	async update(data: Partial<Config>): Promise<Config> {
		const config = await this.repo.update(data);
		notifyDataChanged();
		return config;
	}
}
