<script lang="ts">
import { onMount } from "svelte";

interface CheckInEntry {
	checkedAt: string;
	note?: string;
}

interface CheckInStore {
	targetDays: number;
	records: Record<string, CheckInEntry>;
	updatedAt: string;
}

interface ApiResponse {
	configured?: boolean;
	mode?: "cloud" | "local";
	data?: CheckInStore | null;
	error?: string;
}

interface CycleBounds {
	cycleYear: number;
	cycleMonth: number;
	startDate: Date;
	endDate: Date;
	startKey: string;
	endKey: string;
	rangeLabel: string;
	shortRangeLabel: string;
}

interface CalendarCell {
	dateKey: string;
	month: number;
	day: number;
	isInCycle: boolean;
	isToday: boolean;
	isWeekend: boolean;
	isCycleBoundary: boolean;
}

const LOCAL_STORAGE_KEY = "firefly_checkin_records_v1";
const CYCLE_START_DAY = 16;
const TARGET_DAYS = 18;
const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

function pad2(n: number): string {
	return String(n).padStart(2, "0");
}

function formatDateKey(date: Date): string {
	return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function parseDateKey(dateKey: string): Date {
	const [y, m, d] = dateKey.split("-").map(Number);
	return new Date(y, m - 1, d);
}

function getCurrentTimeHHMM(): string {
	const now = new Date();
	return `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
}

function getCycleForDate(date: Date): {
	cycleYear: number;
	cycleMonth: number;
} {
	if (date.getDate() >= CYCLE_START_DAY) {
		return { cycleYear: date.getFullYear(), cycleMonth: date.getMonth() };
	}
	const prev = new Date(date.getFullYear(), date.getMonth() - 1, 1);
	return { cycleYear: prev.getFullYear(), cycleMonth: prev.getMonth() };
}

function getCycleBounds(cycleYear: number, cycleMonth: number): CycleBounds {
	const startDate = new Date(cycleYear, cycleMonth, CYCLE_START_DAY);
	const endDate = new Date(cycleYear, cycleMonth + 1, CYCLE_START_DAY - 1);
	const startKey = formatDateKey(startDate);
	const endKey = formatDateKey(endDate);

	const startY = startDate.getFullYear();
	const startM = startDate.getMonth() + 1;
	const endY = endDate.getFullYear();
	const endM = endDate.getMonth() + 1;

	const rangeLabel =
		startY === endY
			? `${startY}年${startM}月16日 ~ ${endM}月15日`
			: `${startY}年${startM}月16日 ~ ${endY}年${endM}月15日`;
	const shortRangeLabel = `${startM}/16~${endM}/15`;

	return {
		cycleYear,
		cycleMonth,
		startDate,
		endDate,
		startKey,
		endKey,
		rangeLabel,
		shortRangeLabel,
	};
}

function createEmptyStore(): CheckInStore {
	return {
		targetDays: TARGET_DAYS,
		records: {},
		updatedAt: new Date().toISOString(),
	};
}

function normalizeStore(raw: unknown): CheckInStore {
	if (!raw || typeof raw !== "object") return createEmptyStore();
	const obj = raw as Record<string, unknown>;
	const targetNum = Number(obj.targetDays);
	const targetDays = Number.isFinite(targetNum)
		? Math.min(31, Math.max(1, Math.round(targetNum)))
		: TARGET_DAYS;

	const records: Record<string, CheckInEntry> = {};
	if (obj.records && typeof obj.records === "object") {
		for (const [dateKey, val] of Object.entries(
			obj.records as Record<string, unknown>,
		)) {
			if (
				!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) ||
				!val ||
				typeof val !== "object"
			) {
				continue;
			}
			const item = val as Record<string, unknown>;
			const checkedAt =
				typeof item.checkedAt === "string" && item.checkedAt.trim()
					? item.checkedAt.trim().slice(0, 32)
					: "已打卡";
			const note =
				typeof item.note === "string" && item.note.trim()
					? item.note.trim().slice(0, 80)
					: undefined;
			records[dateKey] = note ? { checkedAt, note } : { checkedAt };
		}
	}

	return {
		targetDays,
		records,
		updatedAt:
			typeof obj.updatedAt === "string"
				? obj.updatedAt
				: new Date().toISOString(),
	};
}

function buildCycleCalendarCells(
	bounds: CycleBounds,
	todayKey: string,
): CalendarCell[] {
	const startOffset = (bounds.startDate.getDay() + 6) % 7;
	const gridStart = new Date(
		bounds.startDate.getFullYear(),
		bounds.startDate.getMonth(),
		bounds.startDate.getDate() - startOffset,
	);

	const endOffset = (7 - ((bounds.endDate.getDay() + 6) % 7) - 1 + 7) % 7;
	const gridEnd = new Date(
		bounds.endDate.getFullYear(),
		bounds.endDate.getMonth(),
		bounds.endDate.getDate() + endOffset,
	);

	const cells: CalendarCell[] = [];
	const cursor = new Date(
		gridStart.getFullYear(),
		gridStart.getMonth(),
		gridStart.getDate(),
	);

	while (cursor <= gridEnd) {
		const dateKey = formatDateKey(cursor);
		const dayOfWeek = cursor.getDay();
		const day = cursor.getDate();
		const isInCycle = dateKey >= bounds.startKey && dateKey <= bounds.endKey;
		cells.push({
			dateKey,
			month: cursor.getMonth() + 1,
			day,
			isInCycle,
			isToday: dateKey === todayKey,
			isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
			isCycleBoundary:
				dateKey === bounds.startKey ||
				dateKey === bounds.endKey ||
				(isInCycle && day === 1),
		});
		cursor.setDate(cursor.getDate() + 1);
	}

	return cells;
}

const now = new Date();
const todayKey = formatDateKey(now);
const currentCycle = getCycleForDate(now);

let store = $state<CheckInStore>(createEmptyStore());
let viewCycleYear = $state(currentCycle.cycleYear);
let viewCycleMonth = $state(currentCycle.cycleMonth);
let syncMode = $state<"loading" | "cloud" | "local">("loading");
let isSaving = $state(false);
let errorMessage = $state("");
let showHistory = $state(false);
let localExtraCount = $state(0);

const cycleBounds = $derived(getCycleBounds(viewCycleYear, viewCycleMonth));
const isViewingCurrentCycle = $derived(
	viewCycleYear === currentCycle.cycleYear &&
		viewCycleMonth === currentCycle.cycleMonth,
);
const calendarCells = $derived(buildCycleCalendarCells(cycleBounds, todayKey));

const cycleCount = $derived(
	Object.keys(store.records).filter(
		(key) => key >= cycleBounds.startKey && key <= cycleBounds.endKey,
	).length,
);
const targetDays = $derived(store.targetDays || TARGET_DAYS);
const remainingToTarget = $derived(Math.max(0, targetDays - cycleCount));
const progressPercent = $derived(
	Math.min(100, Math.round((cycleCount / Math.max(1, targetDays)) * 100)),
);
const isCycleGoalMet = $derived(cycleCount >= targetDays);

const daysLeftInCurrentCycle = $derived.by(() => {
	if (!isViewingCurrentCycle) return 0;
	const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
	const endUtc = Date.UTC(
		cycleBounds.endDate.getFullYear(),
		cycleBounds.endDate.getMonth(),
		cycleBounds.endDate.getDate(),
	);
	const remainingAfterToday = Math.max(
		0,
		Math.round((endUtc - todayUtc) / 86400000),
	);
	return store.records[todayKey]
		? remainingAfterToday
		: remainingAfterToday + 1;
});

const yearlyCyclesSummary = $derived.by(() => {
	const list: Array<{
		cycleMonth: number;
		title: string;
		shortRange: string;
		count: number;
		met: boolean;
		isCurrent: boolean;
	}> = [];
	for (let m = 0; m < 12; m++) {
		const b = getCycleBounds(viewCycleYear, m);
		const count = Object.keys(store.records).filter(
			(k) => k >= b.startKey && k <= b.endKey,
		).length;
		list.push({
			cycleMonth: m,
			title: `${m + 1}月期`,
			shortRange: b.shortRangeLabel,
			count,
			met: count >= targetDays,
			isCurrent:
				viewCycleYear === currentCycle.cycleYear &&
				m === currentCycle.cycleMonth,
		});
	}
	return list;
});

const todayRecord = $derived(store.records[todayKey]);

function readLocalCache(): CheckInStore {
	try {
		const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
		if (!raw) return createEmptyStore();
		return normalizeStore(JSON.parse(raw));
	} catch {
		return createEmptyStore();
	}
}

function writeLocalCache(next: CheckInStore): void {
	try {
		localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(next));
	} catch {
		// 忽略浏览器存储限制
	}
}

async function loadInitialData(): Promise<void> {
	const localData = readLocalCache();
	store = localData;

	try {
		const res = await fetch("/api/checkin", { cache: "no-store" });
		if (!res.ok) {
			syncMode = "local";
			return;
		}
		const payload = (await res.json()) as ApiResponse;
		if (!payload.configured || payload.mode !== "cloud" || !payload.data) {
			syncMode = "local";
			return;
		}

		const cloudStore = normalizeStore(payload.data);
		localExtraCount = Object.keys(localData.records).filter(
			(k) => !cloudStore.records[k],
		).length;
		store = cloudStore;
		writeLocalCache(cloudStore);
		syncMode = "cloud";
	} catch {
		syncMode = "local";
	}
}

async function mutateStore(
	body: Record<string, unknown>,
	localUpdater: (prev: CheckInStore) => CheckInStore,
): Promise<void> {
	isSaving = true;
	errorMessage = "";
	const optimistic = localUpdater(store);
	store = optimistic;
	writeLocalCache(optimistic);

	if (syncMode === "cloud") {
		try {
			const res = await fetch("/api/checkin", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});
			const payload = (await res.json()) as ApiResponse;
			if (!res.ok || payload.error || !payload.data) {
				throw new Error(payload.error || "云端保存失败");
			}
			const serverStore = normalizeStore(payload.data);
			store = serverStore;
			writeLocalCache(serverStore);
		} catch (err) {
			errorMessage =
				err instanceof Error ? `${err.message}（已暂存本地）` : "云端保存失败";
		} finally {
			isSaving = false;
		}
	} else {
		isSaving = false;
	}
}

async function toggleDate(dateKey: string): Promise<void> {
	const exists = Boolean(store.records[dateKey]);
	const time = getCurrentTimeHHMM();

	await mutateStore(
		exists
			? { action: "remove", date: dateKey }
			: { action: "upsert", date: dateKey, checkedAt: time },
		(prev) => {
			const nextRecords = { ...prev.records };
			if (exists) {
				delete nextRecords[dateKey];
			} else {
				nextRecords[dateKey] = { checkedAt: time };
			}
			return {
				...prev,
				records: nextRecords,
				updatedAt: new Date().toISOString(),
			};
		},
	);
}

function handleCellClick(cell: CalendarCell): void {
	if (!cell.isInCycle) {
		const targetCycle = getCycleForDate(parseDateKey(cell.dateKey));
		viewCycleYear = targetCycle.cycleYear;
		viewCycleMonth = targetCycle.cycleMonth;
		return;
	}
	void toggleDate(cell.dateKey);
}

async function syncLocalToCloud(): Promise<void> {
	const localData = readLocalCache();
	await mutateStore(
		{ action: "import", data: localData, merge: true },
		(prev) => ({
			...prev,
			records: { ...localData.records, ...prev.records },
			updatedAt: new Date().toISOString(),
		}),
	);
	localExtraCount = 0;
}

function switchCycle(delta: number): void {
	const target = new Date(viewCycleYear, viewCycleMonth + delta, 1);
	viewCycleYear = target.getFullYear();
	viewCycleMonth = target.getMonth();
}

function jumpToCurrentCycle(): void {
	viewCycleYear = currentCycle.cycleYear;
	viewCycleMonth = currentCycle.cycleMonth;
}

onMount(() => {
	void loadInitialData();
});
</script>

<div class="space-y-4">
	{#if errorMessage}
		<div class="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-600 dark:text-red-400">
			{errorMessage}
		</div>
	{/if}

	<!-- 核心进度 + 今日打卡（一卡搞定） -->
	<div class="rounded-2xl border border-(--line-divider) bg-(--card-bg) p-5 space-y-4">
		<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
			<div>
				<div class="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
					<span>{cycleBounds.rangeLabel}</span>
					{#if syncMode === "cloud"}
						<span class="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
							<span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
							已同步
						</span>
					{:else if syncMode === "local"}
						<span class="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
							<span class="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
							本地模式
						</span>
					{/if}
				</div>

				<div class="mt-1 flex items-baseline gap-3 flex-wrap">
					<div class="flex items-baseline gap-1.5">
						<span class="text-4xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
							{cycleCount}
						</span>
						<span class="text-base font-medium text-neutral-500 dark:text-neutral-400">
							/ {targetDays} 天
						</span>
					</div>

					{#if isCycleGoalMet}
						<span class="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
							已达标 🎉{cycleCount > targetDays ? ` (+${cycleCount - targetDays}天)` : ""}
						</span>
					{:else if isViewingCurrentCycle && remainingToTarget > daysLeftInCurrentCycle}
						<span class="text-xs font-semibold text-red-500">
							还差 {remainingToTarget} 天（本周期仅剩 {daysLeftInCurrentCycle} 天）
						</span>
					{:else if isViewingCurrentCycle}
						<span class="text-xs font-medium text-(--primary)">
							还差 {remainingToTarget} 天 · 本周期余 {daysLeftInCurrentCycle} 天
						</span>
					{:else}
						<span class="text-xs text-neutral-500">
							差 {remainingToTarget} 天未达标
						</span>
					{/if}
				</div>
			</div>

			<button
				type="button"
				disabled={isSaving}
				onclick={() => void toggleDate(todayKey)}
				class={`shrink-0 rounded-xl px-5 py-3 text-sm font-semibold transition cursor-pointer disabled:opacity-60 ${
					todayRecord
						? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/35 hover:bg-emerald-500/25"
						: "bg-(--primary) text-white dark:text-black/80 hover:opacity-90"
				}`}
			>
				{#if todayRecord}
					今日已打卡 ✓ ({todayRecord.checkedAt})
				{:else}
					今日打卡
				{/if}
			</button>
		</div>

		<div class="h-2.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
			<div
				class={`h-full rounded-full transition-all duration-500 ${
					isCycleGoalMet ? "bg-emerald-500" : "bg-(--primary)"
				}`}
				style={`width: ${progressPercent}%`}
			></div>
		</div>

		{#if localExtraCount > 0 && syncMode === "cloud"}
			<button
				type="button"
				onclick={syncLocalToCloud}
				disabled={isSaving}
				class="rounded-lg bg-(--primary)/15 px-3 py-1.5 text-xs font-medium text-(--primary) hover:bg-(--primary)/25 transition cursor-pointer"
			>
				发现 {localExtraCount} 条本地未同步记录，点击合并到云端
			</button>
		{/if}
	</div>

	<!-- 周期日历（点击日期直接打卡/取消） -->
	<div class="rounded-2xl border border-(--line-divider) bg-(--card-bg) p-4 sm:p-5">
		<div class="flex items-center justify-between gap-2 mb-4">
			<div class="flex items-center gap-2">
				<button
					type="button"
					onclick={() => switchCycle(-1)}
					aria-label="上个周期"
					class="h-8 w-8 rounded-lg border border-(--line-divider) flex items-center justify-center text-neutral-700 dark:text-neutral-200 hover:border-(--primary) hover:text-(--primary) transition cursor-pointer"
				>
					‹
				</button>
				<div class="text-sm sm:text-base font-bold text-neutral-900 dark:text-neutral-100 px-1">
					{cycleBounds.rangeLabel}
				</div>
				<button
					type="button"
					onclick={() => switchCycle(1)}
					aria-label="下个周期"
					class="h-8 w-8 rounded-lg border border-(--line-divider) flex items-center justify-center text-neutral-700 dark:text-neutral-200 hover:border-(--primary) hover:text-(--primary) transition cursor-pointer"
				>
					›
				</button>
			</div>

			<div class="flex items-center gap-2">
				{#if !isViewingCurrentCycle}
					<button
						type="button"
						onclick={jumpToCurrentCycle}
						class="rounded-lg bg-(--btn-regular-bg) px-2.5 py-1 text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:text-(--primary) transition cursor-pointer"
					>
						回本期
					</button>
				{:else}
					<span class="text-xs text-neutral-400">点日期即可补卡/取消</span>
				{/if}
			</div>
		</div>

		<div class="grid grid-cols-7 gap-1.5 sm:gap-2 mb-2 text-center text-xs font-medium text-neutral-400">
			{#each WEEKDAYS as dayName}
				<div>{dayName}</div>
			{/each}
		</div>

		<div class="grid grid-cols-7 gap-1.5 sm:gap-2">
			{#each calendarCells as cell}
				{@const entry = store.records[cell.dateKey]}
				<button
					type="button"
					onclick={() => handleCellClick(cell)}
					class={`h-12 sm:h-14 rounded-xl px-1.5 py-1.5 flex flex-col items-center justify-center gap-0.5 transition cursor-pointer border ${
						entry && cell.isInCycle
							? "bg-(--primary)/18 border-(--primary)/50 text-neutral-900 dark:text-neutral-100 hover:bg-(--primary)/28"
							: cell.isInCycle
								? cell.isWeekend
									? "bg-neutral-100/55 dark:bg-neutral-800/30 border-(--line-divider) text-neutral-500 dark:text-neutral-400 hover:border-(--primary)/40"
									: "bg-transparent border-(--line-divider) text-neutral-800 dark:text-neutral-200 hover:border-(--primary)/40"
								: "bg-transparent border-transparent text-neutral-300 dark:text-neutral-700 hover:border-(--line-divider)"
					} ${cell.isToday ? "ring-2 ring-(--primary) ring-offset-1 ring-offset-(--card-bg)" : ""}`}
				>
					<span class={`text-xs sm:text-sm font-semibold leading-none ${cell.isToday ? "text-(--primary)" : ""}`}>
						{cell.isCycleBoundary ? `${cell.month}/${cell.day}` : cell.day}
					</span>
					{#if entry && cell.isInCycle}
						<span class="text-[10px] font-bold leading-none text-(--primary)">✓</span>
					{:else if cell.isToday}
						<span class="text-[10px] leading-none text-(--primary)">今天</span>
					{/if}
				</button>
			{/each}
		</div>
	</div>

	<!-- 底部极简往期开关 -->
	<div class="flex items-center justify-between text-xs text-neutral-400 px-1">
		<span>点击「今日打卡」或日历格子会自动保存</span>
		<button
			type="button"
			onclick={() => (showHistory = !showHistory)}
			class="hover:text-(--primary) transition cursor-pointer"
		>
			{showHistory ? "收起各期统计" : `查看 ${viewCycleYear} 年各期统计`}
		</button>
	</div>

	{#if showHistory}
		<div class="rounded-2xl border border-(--line-divider) bg-(--card-bg) p-4">
			<div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
				{#each yearlyCyclesSummary as item}
					<button
						type="button"
						onclick={() => (viewCycleMonth = item.cycleMonth)}
						class={`rounded-xl border p-2 text-left transition cursor-pointer ${
							item.cycleMonth === viewCycleMonth
								? "border-(--primary) bg-(--primary)/10"
								: item.met
									? "border-emerald-500/35 bg-emerald-500/8"
									: "border-(--line-divider) hover:border-(--primary)/40"
						}`}
					>
						<div class="flex items-center justify-between text-xs">
							<span class="font-medium text-neutral-800 dark:text-neutral-200">{item.title}</span>
							{#if item.met}
								<span class="text-emerald-600 dark:text-emerald-400 font-bold">✓</span>
							{/if}
						</div>
						<div class="text-[10px] text-neutral-400">{item.shortRange}</div>
						<div class="mt-0.5 text-sm font-bold text-neutral-900 dark:text-neutral-100">
							{item.count}<span class="text-[11px] font-normal text-neutral-400">/{targetDays}</span>
						</div>
					</button>
				{/each}
			</div>
		</div>
	{/if}
</div>
