// A single-process, per-file mutex: every mutation against a given YAML file is queued
// behind the previous one, so a read-modify-write cycle can never interleave with another.
// That's sufficient for a personal-scale, single-Bun-process app — no need for file locks
// that work across processes/machines.
export class AsyncLock {
	private queue: Promise<unknown> = Promise.resolve();

	run<T>(fn: () => Promise<T> | T): Promise<T> {
		const result = this.queue.then(fn, fn);
		// Swallow the result/error here so a failed task doesn't wedge the queue for
		// everyone after it — callers still observe the real rejection via `result`.
		this.queue = result.then(
			() => undefined,
			() => undefined,
		);
		return result;
	}
}
