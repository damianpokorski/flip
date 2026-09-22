import { describe, expect, test } from "bun:test";
import { hueFor } from "./hue";
import { TILE_HUES } from "./schemas/service";

describe("hueFor", () => {
	test("is deterministic for the same name", () => {
		// Arrange
		const name = "Jellyfin";

		// Act
		const first = hueFor(name);
		const second = hueFor(name);

		// Assert
		expect(first).toBe(second);
	});

	test("is case-insensitive", () => {
		// Arrange & Act
		const lower = hueFor("home assistant");
		const upper = hueFor("HOME ASSISTANT");

		// Assert
		expect(lower).toBe(upper);
	});

	test("always returns a valid tile hue", () => {
		// Arrange
		const names = ["Sonarr", "Radarr", "Plex", "Grafana", "Portainer"];

		// Act & Assert
		for (const name of names) {
			expect(TILE_HUES).toContain(hueFor(name));
		}
	});

	test("spreads a sample of distinct names across more than one hue", () => {
		// Arrange
		const names = [
			"Sonarr",
			"Radarr",
			"Plex",
			"Grafana",
			"Portainer",
			"Jellyfin",
			"Home Assistant",
			"Pi-hole",
			"Nextcloud",
			"Prowlarr",
		];

		// Act
		const hues = new Set(names.map(hueFor));

		// Assert
		expect(hues.size).toBeGreaterThan(1);
	});
});
