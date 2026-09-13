import { watch } from "node:fs";
import {
	chmod,
	mkdir,
	readFile,
	rename,
	stat,
	writeFile,
} from "node:fs/promises";
import path from "node:path";
import { env } from "@flip/env/server";
import { type Document, isMap, parseDocument } from "yaml";
import type { z } from "zod";
import { AsyncLock } from "./lock";

export function dataDir(): string {
	return env.DATA_DIR;
}

export function dataFilePath(fileName: string): string {
	return path.join(dataDir(), fileName);
}

const WATCH_DEBOUNCE_MS = 200;

// a+rwx — deliberately permissive so a container process (often a different UID than
// whatever created/owns a bind-mounted DATA_DIR) can always read/write its own files.
// Applied only at the moment a file/dir is created, never against something that already
// exists, so it can't clobber permissions a user has intentionally locked down.
const CREATED_MODE = 0o777;

// Creates DATA_DIR if missing and chmods it to CREATED_MODE, but only on the call that
// actually creates it — `mkdir(..., { recursive: true })` resolves with the first path it
// created, or `undefined` if the directory already existed, which is exactly the signal
// needed here.
async function ensureDataDirCreated(): Promise<void> {
	const created = await mkdir(dataDir(), { recursive: true });
	if (created !== undefined) await chmod(dataDir(), CREATED_MODE);
}

// For a map-root document (every plain-object schema, e.g. config.yaml), the `yaml` package
// attaches the leading "header" comment to the first key's `commentBefore`, not to
// `Document.commentBefore` (which only applies to non-map roots) — see fs-yaml.test.ts for a
// worked example. These read/write that header regardless of which case applies.
function getHeaderComment(doc: Document): string | null {
	const { contents } = doc;
	const first = isMap(contents) ? contents.items[0] : undefined;
	if (first)
		return (
			(first.key as { commentBefore?: string | null }).commentBefore ?? null
		);
	return doc.commentBefore;
}

function setHeaderComment(doc: Document, comment: string | null): void {
	const { contents } = doc;
	const first = isMap(contents) ? contents.items[0] : undefined;
	if (first) {
		(first.key as { commentBefore?: string | null }).commentBefore = comment;
		return;
	}
	doc.commentBefore = comment;
}

export interface YamlFileOptions {
	// When set, ensureExists() also reconciles an already-existing file against the current
	// schema: any top-level field the schema now defines with a default but the on-disk file
	// doesn't have gets backfilled in, and the file's leading header comment is refreshed to
	// match defaultContent's. Off by default — only meaningful for plain-object (not
	// array-of-object) schemas today. See migrateExistingFile().
	migrateNewDefaultsOnBoot?: boolean;
}

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
		private readonly options: YamlFileOptions = {},
	) {}

	private get path(): string {
		return dataFilePath(this.fileName);
	}

	// Ensures DATA_DIR and this file exist. Never overwrites an existing file's data wholesale
	// — purely additive, safe to call on every boot (mirrors the old runMigrations() safety-net
	// call). If the file already exists and migrateNewDefaultsOnBoot is set, reconciles it
	// against the current schema instead of just leaving it alone.
	async ensureExists(): Promise<void> {
		await ensureDataDirCreated();
		const file = Bun.file(this.path);
		if (await file.exists()) {
			if (this.options.migrateNewDefaultsOnBoot)
				await this.migrateExistingFile();
			return;
		}
		await writeFile(this.path, this.defaultContent, "utf8");
		// Self-test: confirm our own generated default actually satisfies the schema,
		// so a typo in a default template fails loudly at boot instead of surfacing
		// later as a confusing validation error against a file the user never touched.
		this.schema.parse(parseDocument(this.defaultContent).toJS());
		await chmod(this.path, CREATED_MODE);
	}

	// Backfills any top-level field the schema now defaults but this on-disk file predates
	// (added after the file was created, so zod's .default() would otherwise only apply
	// in-memory — see readFresh()). Only touches the file when something is actually missing;
	// an already-current file is left byte-for-byte alone. Errors (e.g. a read-only mount)
	// propagate rather than being swallowed, so a failed migration fails boot loudly instead
	// of silently running with an unpersisted change.
	private async migrateExistingFile(): Promise<void> {
		return this.lock.run(async () => {
			const { doc, data } = await this.readFresh();
			let changed = false;
			for (const key of Object.keys(data as object)) {
				if (!doc.has(key)) {
					doc.set(key, (data as Record<string, unknown>)[key]);
					changed = true;
				}
			}
			if (!changed) return;
			// Field docs live in the header comment — once the file's shape has actually
			// diverged from the template, refresh it too so it doesn't go stale, even if the
			// existing header was hand-edited.
			setHeaderComment(
				doc,
				getHeaderComment(parseDocument(this.defaultContent)),
			);
			// Self-test the migrated content before committing, same rationale as the
			// fresh-create self-test above.
			this.schema.parse(parseDocument(doc.toString()).toJS());
			await this.writeDoc(doc);
			this.cache = data;
			console.log(
				`[@flip/store] ${this.fileName}: backfilled new default field(s) on disk.`,
			);
		});
	}

	private async writeDoc(doc: Document): Promise<void> {
		const text = doc.toString();
		const tmpPath = `${this.path}.tmp-${process.pid}-${Date.now()}`;
		await writeFile(tmpPath, text, "utf8");
		await rename(tmpPath, this.path);
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
			await this.writeDoc(doc);
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
