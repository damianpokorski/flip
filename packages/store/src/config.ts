import { combinedConfigFile } from "./combined-file";
import type { CombinedConfig, Config } from "./schemas/config";

export const configStore = {
	ensureExists: () => combinedConfigFile.ensureExists(),
	onChange: (listener: (config: CombinedConfig) => void) =>
		combinedConfigFile.onChange(listener),
	watch: () => combinedConfigFile.watch(),
	readRaw: () => combinedConfigFile.readRaw(),

	// Scalar settings only — strips `workspaces` so this store's contract stays "just the
	// global settings", matching its shape before services/workspaces were folded into the
	// same physical file.
	async get(): Promise<Config> {
		const { workspaces: _workspaces, ...config } =
			await combinedConfigFile.read();
		return config;
	},

	async update(patch: Partial<Config>): Promise<Config> {
		const { workspaces: _workspaces, ...config } =
			await combinedConfigFile.mutate((doc) => {
				for (const [key, value] of Object.entries(patch)) {
					doc.setIn([key], value);
				}
			});
		return config;
	},
};
