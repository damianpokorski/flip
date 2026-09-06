import { watch } from "node:fs";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@flip/env/server";
import { type Document, parseDocument } from "yaml";
import type { z } from "zod";
import { AsyncLock } from "./lock";

export function dataDir(): string {
	return env.DATA_DIR;
}

export function dataFilePath(fileName: string): string {
	return path.join(dataDir(), fileName);
}

const WATCH_DEBOUNCE_MS = 200;

// A single YAML file backing one "table" (an array or a single object), read/written via
// yaml's `Document` API rather than plain parse/stringify so that comments and formatting
// on any untouched part of the file survive a mutation — the whole point of storing config
// in a format power users are expected to hand-edit.
export class YamlFile<T> {
	private readonly lock = new AsyncLock();
	private cache: T | undefined;
	private readonly listeners = new Set<(data: T) => void>();

	constructor(
		private readonly fileName: string,
		private readonly schema: z.ZodType<T>,
		private readonly defaultContent: string,
	) {}

	private get path(): string {
		return dataFilePath(this.fileName);
	}

	// Ensures DATA_DIR and this file exist. Never overwrites an existing file — purely
	// additive, safe to call on every boot (mirrors the old runMigrations() safety-net call).
	async ensureExists(): Promise<void> {
		await mkdir(dataDir(), { recursive: true });
		const file = Bun.file(this.path);
		if (await file.exists()) return;
		await writeFile(this.path, this.defaultContent, "utf8");
		// Self-test: confirm our own generated default actually satisfies the schema,
		// so a typo in a default template fails loudly at boot instead of surfacing
		// later as a confusing validation error against a file the user never touched.
		this.schema.parse(parseDocument(this.defaultContent).toJS());
	}

	private async readFresh(): Promise<{ doc: Document; data: T }> {
		const text = await readFile(this.path, "utf8");
		const doc = parseDocument(text);
		const data = this.schema.parse(doc.toJS());
		return { doc, data };
	}

	async read(): Promise<T> {
		if (this.cache !== undefined) return this.cache;
		const { data } = await this.readFresh();
		this.cache = data;
		return data;
	}

	// Raw file text + last-modified time, for a genuine live view of the on-disk YAML (the
	// Settings → Config tab) — `.read()`/`.toJS()` strips the comments this needs to show.
	async readRaw(): Promise<{ content: string; updatedAt: string }> {
		const [content, stats] = await Promise.all([
			readFile(this.path, "utf8"),
			stat(this.path),
		]);
		return { content, updatedAt: stats.mtime.toISOString() };
	}

	// Re-reads from disk (never trusts a stale in-memory copy — the file may have been
	// hand-edited since the last read), applies `fn` to the live Document, validates the
	// result, then writes atomically (temp file + rename) before releasing the lock.
	async mutate(fn: (doc: Document) => void): Promise<T> {
		return this.lock.run(async () => {
			const { doc } = await this.readFresh();
			fn(doc);
			const data = this.schema.parse(doc.toJS());
			const text = doc.toString();
			const tmpPath = `${this.path}.tmp-${process.pid}-${Date.now()}`;
			await writeFile(tmpPath, text, "utf8");
			await rename(tmpPath, this.path);
			this.cache = data;
			return data;
		});
	}

	// Fires whenever a change to the file on disk is detected and successfully validated —
	// this includes both hand-edits and this process's own writes (the latter is a harmless,
	// idempotent redundant notification, not worth suppressing).
	onChange(listener: (data: T) => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	// Starts watching this file for external changes. Returns a stop function. Call once
	// per process (e.g. at server startup), not per-request.
	watch(): () => void {
		let debounceHandle: ReturnType<typeof setTimeout> | undefined;
		const watcher = watch(this.path, () => {
			clearTimeout(debounceHandle);
			debounceHandle = setTimeout(async () => {
				try {
					const { data } = await this.readFresh();
					this.cache = data;
					for (const listener of this.listeners) listener(data);
				} catch (err) {
					// Hand-edited files can transiently fail validation (e.g. mid-save, or a
					// genuine mistake) — log loudly and keep serving the last-known-good data
					// rather than crash or serve broken state.
					console.error(
						`[@flip/store] ${this.fileName} changed on disk but failed validation — keeping last-known-good data in memory.`,
					);
					console.error(err);
				}
			}, WATCH_DEBOUNCE_MS);
		});
		return () => {
			clearTimeout(debounceHandle);
			watcher.close();
		};
	}
}
