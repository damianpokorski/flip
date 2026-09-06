import type { Config } from "@flip/store";
import { configStore } from "@flip/store";

export type { Config };

// Thin wrapper over @flip/store's YAML-backed accessor — no business logic here.
export class ConfigRepository {
	get(): Promise<Config> {
		return configStore.get();
	}

	readRaw(): Promise<{ content: string; updatedAt: string }> {
		return configStore.readRaw();
	}
}
