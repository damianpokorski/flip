import { DEFAULT_PANELS_YAML } from "./defaults";
import { YamlFile } from "./fs-yaml";
import { type Panel, PanelsFileSchema } from "./schemas/panels";

const panelsFile = new YamlFile(
	"panels.yaml",
	PanelsFileSchema,
	DEFAULT_PANELS_YAML,
);

export type NewPanel = Omit<Panel, "position">;
export type PanelPatch = Partial<Omit<Panel, "id" | "position">>;

export const panelsStore = {
	ensureExists: () => panelsFile.ensureExists(),
	onChange: (listener: (panels: Panel[]) => void) =>
		panelsFile.onChange(listener),
	watch: () => panelsFile.watch(),

	async findAll(): Promise<Panel[]> {
		const panels = await panelsFile.read();
		return [...panels].sort((a, b) => a.position - b.position);
	},

	async findById(id: string): Promise<Panel | undefined> {
		const panels = await panelsFile.read();
		return panels.find((panel) => panel.id === id);
	},

	async create(input: NewPanel): Promise<Panel> {
		const panels = await panelsFile.mutate((doc) => {
			const current = (doc.toJS() ?? []) as Panel[];
			const position =
				current.length === 0
					? 0
					: Math.max(...current.map((panel) => panel.position)) + 1;
			doc.add({ ...input, position });
		});
		// biome-ignore lint/style/noNonNullAssertion: we just inserted this id above
		return panels.find((panel) => panel.id === input.id)!;
	},

	async update(id: string, patch: PanelPatch): Promise<Panel | undefined> {
		const panels = await panelsFile.mutate((doc) => {
			const current = (doc.toJS() ?? []) as Panel[];
			const index = current.findIndex((panel) => panel.id === id);
			if (index === -1) return;
			for (const [key, value] of Object.entries(patch)) {
				doc.setIn([index, key], value);
			}
		});
		return panels.find((panel) => panel.id === id);
	},

	async delete(id: string): Promise<Panel | undefined> {
		let deleted: Panel | undefined;
		await panelsFile.mutate((doc) => {
			const current = (doc.toJS() ?? []) as Panel[];
			const index = current.findIndex((panel) => panel.id === id);
			if (index === -1) return;
			deleted = current[index];
			doc.deleteIn([index]);
		});
		return deleted;
	},

	async reorder(orderedIds: string[]): Promise<Panel[]> {
		const panels = await panelsFile.mutate((doc) => {
			const current = (doc.toJS() ?? []) as Panel[];
			const indexById = new Map(
				current.map((panel, index) => [panel.id, index]),
			);
			orderedIds.forEach((id, position) => {
				const index = indexById.get(id);
				if (index !== undefined) doc.setIn([index, "position"], position);
			});
		});
		return [...panels].sort((a, b) => a.position - b.position);
	},
};
