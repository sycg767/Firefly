import { createClient } from "redis";

const REDIS_KEY = "blog:checkin:v1";
const DEFAULT_TARGET_DAYS = 18;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

interface CheckInEntry {
	checkedAt: string;
	note?: string;
}

interface CheckInStore {
	targetDays: number;
	records: Record<string, CheckInEntry>;
	updatedAt: string;
}

interface RestRedisConfig {
	url: string;
	token: string;
}

type StorageBackend =
	| { kind: "tcp"; url: string }
	| { kind: "rest"; config: RestRedisConfig };

function getStorageBackend(): StorageBackend | null {
	const redisUrl = process.env.REDIS_URL?.trim();
	if (redisUrl) {
		return { kind: "tcp", url: redisUrl };
	}

	const restUrl =
		process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "";
	const restToken =
		process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "";

	if (restUrl && restToken) {
		return {
			kind: "rest",
			config: { url: restUrl.replace(/\/+$/, ""), token: restToken },
		};
	}

	return null;
}

function createEmptyStore(): CheckInStore {
	return {
		targetDays: DEFAULT_TARGET_DAYS,
		records: {},
		updatedAt: new Date().toISOString(),
	};
}

function sanitizeNote(note: unknown): string | undefined {
	if (typeof note !== "string") return undefined;
	const trimmed = note.trim().slice(0, 80);
	return trimmed || undefined;
}

function clampTargetDays(
	value: unknown,
	fallback = DEFAULT_TARGET_DAYS,
): number {
	const num = Number(value);
	if (!Number.isFinite(num)) return fallback;
	return Math.min(31, Math.max(1, Math.round(num)));
}

function normalizeStore(raw: unknown): CheckInStore {
	if (!raw || typeof raw !== "object") {
		return createEmptyStore();
	}
	const obj = raw as Record<string, unknown>;
	const records: Record<string, CheckInEntry> = {};

	if (obj.records && typeof obj.records === "object") {
		for (const [date, entry] of Object.entries(
			obj.records as Record<string, unknown>,
		)) {
			if (!DATE_PATTERN.test(date) || !entry || typeof entry !== "object") {
				continue;
			}
			const item = entry as Record<string, unknown>;
			const checkedAt =
				typeof item.checkedAt === "string" && item.checkedAt.trim()
					? item.checkedAt.trim().slice(0, 32)
					: "已打卡";
			const note = sanitizeNote(item.note);
			records[date] = note ? { checkedAt, note } : { checkedAt };
		}
	}

	return {
		targetDays: clampTargetDays(obj.targetDays),
		records,
		updatedAt:
			typeof obj.updatedAt === "string"
				? obj.updatedAt
				: new Date().toISOString(),
	};
}

function parseRawStore(raw: unknown): CheckInStore {
	if (!raw) return createEmptyStore();
	if (typeof raw === "string") {
		try {
			return normalizeStore(JSON.parse(raw));
		} catch {
			return createEmptyStore();
		}
	}
	return normalizeStore(raw);
}

function jsonResponse(payload: unknown, status = 200): Response {
	return new Response(JSON.stringify(payload), {
		status,
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			"Cache-Control": "no-store, max-age=0",
		},
	});
}

function createAppRedisClient(url: string) {
	const client = createClient({
		url,
		socket: {
			connectTimeout: 8000,
			reconnectStrategy: false,
		},
	});
	client.on("error", (err) => {
		console.error("[checkin] Redis client error:", err);
	});
	return client;
}

async function withTcpRedis<T>(
	url: string,
	fn: (client: ReturnType<typeof createAppRedisClient>) => Promise<T>,
): Promise<T> {
	const client = createAppRedisClient(url);
	await client.connect();
	try {
		return await fn(client);
	} finally {
		try {
			await client.quit();
		} catch {
			client.destroy();
		}
	}
}

async function readStore(backend: StorageBackend): Promise<CheckInStore> {
	if (backend.kind === "tcp") {
		return withTcpRedis(backend.url, async (client) => {
			const raw = await client.get(REDIS_KEY);
			return parseRawStore(raw);
		});
	}

	const res = await fetch(
		`${backend.config.url}/get/${encodeURIComponent(REDIS_KEY)}`,
		{
			headers: {
				Authorization: `Bearer ${backend.config.token}`,
			},
		},
	);
	if (!res.ok) {
		throw new Error(`Redis GET failed: ${res.status}`);
	}
	const payload = (await res.json()) as { result?: unknown };
	return parseRawStore(payload.result);
}

async function writeStore(
	backend: StorageBackend,
	store: CheckInStore,
): Promise<void> {
	const serialized = JSON.stringify(store);

	if (backend.kind === "tcp") {
		await withTcpRedis(backend.url, async (client) => {
			await client.set(REDIS_KEY, serialized);
		});
		return;
	}

	const res = await fetch(backend.config.url, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${backend.config.token}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(["SET", REDIS_KEY, serialized]),
	});
	if (!res.ok) {
		throw new Error(`Redis SET failed: ${res.status}`);
	}
}

function getCurrentTimeHHMM(): string {
	const now = new Date();
	const formatter = new Intl.DateTimeFormat("zh-CN", {
		timeZone: "Asia/Shanghai",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});
	return formatter.format(now);
}

export async function GET(): Promise<Response> {
	const backend = getStorageBackend();
	if (!backend) {
		return jsonResponse({
			configured: false,
			mode: "local",
			data: null,
		});
	}

	try {
		const data = await readStore(backend);
		return jsonResponse({
			configured: true,
			mode: "cloud",
			data,
		});
	} catch (error) {
		return jsonResponse(
			{
				configured: true,
				mode: "cloud",
				error: error instanceof Error ? error.message : "Failed to read data",
			},
			500,
		);
	}
}

export async function POST(request: Request): Promise<Response> {
	const backend = getStorageBackend();
	if (!backend) {
		return jsonResponse(
			{
				configured: false,
				mode: "local",
				error: "Cloud storage is not configured",
			},
			200,
		);
	}

	let body: Record<string, unknown>;
	try {
		body = (await request.json()) as Record<string, unknown>;
	} catch {
		return jsonResponse({ error: "Invalid JSON body" }, 400);
	}

	const action = typeof body.action === "string" ? body.action : "";

	try {
		const current = await readStore(backend);
		const next: CheckInStore = {
			targetDays: current.targetDays,
			records: { ...current.records },
			updatedAt: new Date().toISOString(),
		};

		if (action === "upsert" || action === "toggle" || action === "remove") {
			const date = typeof body.date === "string" ? body.date.trim() : "";
			if (!DATE_PATTERN.test(date)) {
				return jsonResponse({ error: "Invalid date format" }, 400);
			}

			const exists = Boolean(next.records[date]);
			if (action === "remove" || (action === "toggle" && exists)) {
				delete next.records[date];
			} else {
				const checkedAt =
					typeof body.checkedAt === "string" && body.checkedAt.trim()
						? body.checkedAt.trim().slice(0, 32)
						: current.records[date]?.checkedAt || getCurrentTimeHHMM();
				const note =
					body.note !== undefined
						? sanitizeNote(body.note)
						: current.records[date]?.note;
				next.records[date] = note ? { checkedAt, note } : { checkedAt };
			}
		} else if (action === "setTarget") {
			next.targetDays = clampTargetDays(body.targetDays, current.targetDays);
		} else if (action === "import") {
			const imported = normalizeStore(body.data);
			const merge = body.merge !== false;
			if (merge) {
				next.records = { ...imported.records, ...next.records };
			} else {
				next.records = imported.records;
				next.targetDays = imported.targetDays;
			}
		} else {
			return jsonResponse({ error: "Unsupported action" }, 400);
		}

		await writeStore(backend, next);
		return jsonResponse({
			configured: true,
			mode: "cloud",
			data: next,
		});
	} catch (error) {
		return jsonResponse(
			{
				configured: true,
				mode: "cloud",
				error: error instanceof Error ? error.message : "Failed to save data",
			},
			500,
		);
	}
}
