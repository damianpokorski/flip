import { DEFAULT_CONFIG_YAML } from "./defaults";
import { YamlFile } from "./fs-yaml";
import { type Config, ConfigSchema } from "./schemas/config";

const configFile = new YamlFile(
	"config.yaml",
	ConfigSchema,
	DEFAULT_CONFIG_YAML,
);

export const configStore = {
	ensureExists: () => configFile.ensureExists(),
	onChange: (listener: (config: Config) => void) =>
		configFile.onChange(listener),
	watch: () => configFile.watch(),
	get: () => configFile.read(),

	async update(patch: Partial<Config>): Promise<Config> {
		return configFile.mutate((doc) => {
			for (const [key, value] of Object.entries(patch)) {
				doc.setIn([key], value);
			}
		});
	},
};
