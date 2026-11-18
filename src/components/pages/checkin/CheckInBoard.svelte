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

interface CalendarCell {
	dateKey: string;
	day: number;
	isCurrentMonth: boolean;
	isToday: boolean;
	isWeekend: boolean;
	isFuture: boolean;
}

const LOCAL_STORAGE_KEY = "firefly_checkin_records_v1";
const QUICK_NOTES = ["正常打卡", "早卡", "外勤", "加班", "补卡"];
const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

function pad2(n: number): string {
	return String(n).padStart(2, "0");
}

function formatDateKey(date: Date): string {
	return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function getCurrentTimeHHMM(): string {
	const now = new Date();
	return `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
}

function createEmptyStore(): CheckInStore {
	return {
		targetDays: 18,
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
		: 18;

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

function buildCalendarCells(
	year: number,
	monthIndex: number,
	todayKey: string,
): CalendarCell[] {
	const firstDay = new Date(year, monthIndex, 1);
	const startOffset = (firstDay.getDay() + 6) % 7; // Monday = 0
	const startDate = new Date(year, monthIndex, 1 - startOffset);
	const cells: CalendarCell[] = [];

	for (let i = 0; i < 42; i++) {
		const cellDate = new Date(
			startDate.getFullYear(),
			startDate.getMonth(),
			startDate.getDate() + i,
		);
		const dateKey = formatDateKey(cellDate);
		const dayOfWeek = cellDate.getDay();
		cells.push({
			dateKey,
			day: cellDate.getDate(),
			isCurrentMonth:
				cellDate.getFullYear() === year && cellDate.getMonth() === monthIndex,
			isToday: dateKey === todayKey,
			isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
			isFuture: dateKey > todayKey,
		});
	}

	// Trim trailing all-next-month row if month fits cleanly in 5 rows
	if (cells.slice(35).every((c) => !c.isCurrentMonth)) {
		return cells.slice(0, 35);
	}
	return cells;
}

function computeCurrentStreak(
	records: Record<string, CheckInEntry>,
	todayKey: string,
): number {
	const [y, m, d] = todayKey.split("-").map(Number);
	const cursor = new Date(y, m - 1, d);
	if (!records[todayKey]) {
		cursor.setDate(cursor.getDate() - 1);
	}
	let streak = 0;
	while (records[formatDateKey(cursor)]) {
		streak += 1;
		cursor.setDate(cursor.getDate() - 1);
	}
	return streak;
}

const now = new Date();
const todayKey = formatDateKey(now);
const currentYearMonth = todayKey.slice(0, 7);

let store = $state<CheckInStore>(createEmptyStore());
let viewYear = $state(now.getFullYear());
let viewMonth = $state(now.getMonth()); // 0-11
let selectedDateKey = $state(todayKey);
let noteDraft = $state("");
let tapToToggle = $state(true);

let syncMode = $state<"loading" | "cloud" | "local">("loading");
let isSaving = $state(false);
let statusMessage = $state("");
let errorMessage = $state("");
let localExtraCount = $state(0);
let fileInputEl = $state<HTMLInputElement | null>(null);

const viewMonthPrefix = $derived(`${viewYear}-${pad2(viewMonth + 1)}`);
const isViewingCurrentMonth = $derived(viewMonthPrefix === currentYearMonth);
const calendarCells = $derived(
	buildCalendarCells(viewYear, viewMonth, todayKey),
);

const monthCheckIns = $derived(
	Object.keys(store.records).filter((key) =>
		key.startsWith(`${viewMonthPrefix}-`),
	),
);
const monthCount = $derived(monthCheckIns.length);
const remainingToTarget = $derived(Math.max(0, store.targetDays - monthCount));
const progressPercent = $derived(
	Math.min(100, Math.round((monthCount / Math.max(1, store.targetDays)) * 100)),
);
const isMonthGoalMet = $derived(monthCount >= store.targetDays);

const daysLeftInCurrentMonth = $derived.by(() => {
	if (!isViewingCurrentMonth) return 0;
	const totalDays = new Date(viewYear, viewMonth + 1, 0).getDate();
	const todayDay = now.getDate();
	const remainingAfterToday = totalDays - todayDay;
	return store.records[todayKey]
		? remainingAfterToday
		: remainingAfterToday + 1;
});

const currentStreak = $derived(computeCurrentStreak(store.records, todayKey));

const yearlySummary = $derived.by(() => {
	const months: Array<{
		monthIndex: number;
		label: string;
		count: number;
		met: boolean;
		isCurrent: boolean;
	}> = [];
	for (let m = 0; m < 12; m++) {
		const prefix = `${viewYear}-${pad2(m + 1)}-`;
		const count = Object.keys(store.records).filter((k) =>
			k.startsWith(prefix),
		).length;
		months.push({
			monthIndex: m,
			label: `${m + 1}月`,
			count,
			met: count >= store.targetDays,
			isCurrent: `${viewYear}-${pad2(m + 1)}` === currentYearMonth,
		});
	}
	return months;
});

const yearMetMonthsCount = $derived(yearlySummary.filter((m) => m.met).length);

const todayRecord = $derived(store.records[todayKey]);
const selectedRecord = $derived(store.records[selectedDateKey]);

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
		// 忽略浏览器存储空间或隐私模式限制
	}
}

function showFlash(msg: string, isError = false): void {
	if (isError) {
		errorMessage = msg;
		statusMessage = "";
	} else {
		statusMessage = msg;
		errorMessage = "";
	}
	setTimeout(() => {
		if (isError && errorMessage === msg) errorMessage = "";
		if (!isError && statusMessage === msg) statusMessage = "";
	}, 3200);
}

async function loadInitialData(): Promise<void> {
	const localData = readLocalCache();
	store = localData;
	noteDraft = store.records[selectedDateKey]?.note || "";

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
		const missingInCloud = Object.keys(localData.records).filter(
			(k) => !cloudStore.records[k],
		).length;
		localExtraCount = missingInCloud;
		store = cloudStore;
		writeLocalCache(cloudStore);
		syncMode = "cloud";
		noteDraft = store.records[selectedDateKey]?.note || "";
	} catch {
		syncMode = "local";
	}
}

async function mutateStore(
	body: Record<string, unknown>,
	localUpdater: (prev: CheckInStore) => CheckInStore,
	successHint: string,
): Promise<void> {
	isSaving = true;
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
			showFlash(successHint);
		} catch (err) {
			showFlash(
				err instanceof Error ? `${err.message}（已暂存本地）` : "云端保存失败",
				true,
			);
		} finally {
			isSaving = false;
		}
	} else {
		isSaving = false;
		showFlash(successHint);
	}
}

async function handleCheckInToday(): Promise<void> {
	const time = getCurrentTimeHHMM();
	const note = noteDraft.trim() || undefined;
	selectedDateKey = todayKey;
	viewYear = now.getFullYear();
	viewMonth = now.getMonth();

	await mutateStore(
		{ action: "upsert", date: todayKey, checkedAt: time, note },
		(prev) => {
			const nextRecords = { ...prev.records };
			nextRecords[todayKey] = note
				? { checkedAt: time, note }
				: { checkedAt: time };
			return {
				...prev,
				records: nextRecords,
				updatedAt: new Date().toISOString(),
			};
		},
		`今日已打卡（${time}）`,
	);
}

async function handleToggleDate(
	dateKey: string,
	forceMode?: "upsert" | "remove",
): Promise<void> {
	const exists = Boolean(store.records[dateKey]);
	const action = forceMode || (exists ? "remove" : "upsert");
	const time = getCurrentTimeHHMM();

	if (action === "remove") {
		await mutateStore(
			{ action: "remove", date: dateKey },
			(prev) => {
				const nextRecords = { ...prev.records };
				delete nextRecords[dateKey];
				return {
					...prev,
					records: nextRecords,
					updatedAt: new Date().toISOString(),
				};
			},
			`已取消 ${dateKey} 的打卡`,
		);
		if (selectedDateKey === dateKey) noteDraft = "";
	} else {
		const note =
			selectedDateKey === dateKey && noteDraft.trim()
				? noteDraft.trim()
				: store.records[dateKey]?.note;
		await mutateStore(
			{ action: "upsert", date: dateKey, checkedAt: time, note },
			(prev) => {
				const nextRecords = { ...prev.records };
				const checkedAt = prev.records[dateKey]?.checkedAt || time;
				nextRecords[dateKey] = note ? { checkedAt, note } : { checkedAt };
				return {
					...prev,
					records: nextRecords,
					updatedAt: new Date().toISOString(),
				};
			},
			`已记录 ${dateKey} 打卡`,
		);
	}
}

async function handleSaveNoteForSelected(): Promise<void> {
	const record = store.records[selectedDateKey];
	const checkedAt = record?.checkedAt || getCurrentTimeHHMM();
	const note = noteDraft.trim();

	await mutateStore(
		{ action: "upsert", date: selectedDateKey, checkedAt, note },
		(prev) => {
			const nextRecords = { ...prev.records };
			nextRecords[selectedDateKey] = note ? { checkedAt, note } : { checkedAt };
			return {
				...prev,
				records: nextRecords,
				updatedAt: new Date().toISOString(),
			};
		},
		`已保存 ${selectedDateKey} 备注`,
	);
}

function handleCellClick(cell: CalendarCell): void {
	selectedDateKey = cell.dateKey;
	noteDraft = store.records[cell.dateKey]?.note || "";

	if (!cell.isCurrentMonth) {
		const [y, m] = cell.dateKey.split("-").map(Number);
		viewYear = y;
		viewMonth = m - 1;
	}

	if (tapToToggle) {
		void handleToggleDate(cell.dateKey);
	}
}

async function handleTargetChange(event: Event): Promise<void> {
	const input = event.currentTarget as HTMLInputElement;
	const parsed = Math.min(
		31,
		Math.max(1, Math.round(Number(input.value) || 18)),
	);
	await mutateStore(
		{ action: "setTarget", targetDays: parsed },
		(prev) => ({
			...prev,
			targetDays: parsed,
			updatedAt: new Date().toISOString(),
		}),
		`月度目标已更新为 ${parsed} 天`,
	);
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
		"已将本地记录合并同步到云端",
	);
	localExtraCount = 0;
}

function switchMonth(delta: number): void {
	const target = new Date(viewYear, viewMonth + delta, 1);
	viewYear = target.getFullYear();
	viewMonth = target.getMonth();
}

function jumpToToday(): void {
	viewYear = now.getFullYear();
	viewMonth = now.getMonth();
	selectedDateKey = todayKey;
	noteDraft = store.records[todayKey]?.note || "";
}

function exportJson(): void {
	const blob = new Blob([JSON.stringify(store, null, 2)], {
		type: "application/json",
	});
	const link = document.createElement("a");
	link.href = URL.createObjectURL(blob);
	link.download = `checkin-backup-${todayKey}.json`;
	link.click();
	URL.revokeObjectURL(link.href);
	showFlash("已导出 JSON 备份文件");
}

async function handleImportFile(event: Event): Promise<void> {
	const input = event.currentTarget as HTMLInputElement;
	const file = input.files?.[0];
	if (!file) return;

	try {
		const text = await file.text();
		const parsed = normalizeStore(JSON.parse(text));
		await mutateStore(
			{ action: "import", data: parsed, merge: true },
			(prev) => ({
				...prev,
				records: { ...parsed.records, ...prev.records },
				updatedAt: new Date().toISOString(),
			}),
			`已导入并合并 ${Object.keys(parsed.records).length} 条打卡记录`,
		);
	} catch {
		showFlash("JSON 文件格式无效，导入失败", true);
	} finally {
		input.value = "";
	}
}

onMount(() => {
	void loadInitialData();
});
</script>

<div class="space-y-6">
	<!-- 顶部同步状态与目标设置 -->
	<div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-(--line-divider) bg-(--card-bg) px-4 py-3">
		<div class="flex flex-wrap items-center gap-2.5 text-sm">
			{#if syncMode === "loading"}
				<span class="inline-flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
					<span class="h-2.5 w-2.5 rounded-full bg-neutral-400 animate-pulse"></span>
					正在连接同步状态...
				</span>
			{:else if syncMode === "cloud"}
				<span class="inline-flex items-center gap-2 font-medium text-emerald-600 dark:text-emerald-400">
					<span class="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
					云端已同步（Vercel Redis）
				</span>
			{:else}
				<span class="inline-flex items-center gap-2 font-medium text-amber-600 dark:text-amber-400">
					<span class="h-2.5 w-2.5 rounded-full bg-amber-500"></span>
					本地存储模式（未检测到云端数据库）
				</span>
			{/if}

			{#if localExtraCount > 0 && syncMode === "cloud"}
				<button
					type="button"
					onclick={syncLocalToCloud}
					disabled={isSaving}
					class="rounded-lg bg-(--primary)/15 px-2.5 py-1 text-xs font-medium text-(--primary) hover:bg-(--primary)/25 transition cursor-pointer"
				>
					发现 {localExtraCount} 条本地记录，点击合并到云端
				</button>
			{/if}
		</div>

		<div class="flex flex-wrap items-center gap-3 text-sm">
			<label class="inline-flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300">
				<span>每月目标</span>
				<input
					type="number"
					min="1"
					max="31"
					value={store.targetDays}
					onchange={handleTargetChange}
					class="w-14 rounded-lg border border-(--line-divider) bg-transparent px-2 py-1 text-center font-semibold text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-(--primary)"
				/>
				<span>天</span>
			</label>
			<button
				type="button"
				onclick={() => void loadInitialData()}
				class="rounded-lg border border-(--line-divider) px-2.5 py-1 text-xs text-neutral-600 dark:text-neutral-300 hover:border-(--primary) hover:text-(--primary) transition cursor-pointer"
			>
				刷新同步
			</button>
		</div>
	</div>

	{#if statusMessage || errorMessage}
		<div
			class={`rounded-xl px-4 py-2.5 text-sm font-medium border ${
				errorMessage
					? "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400"
					: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
			}`}
		>
			{errorMessage || statusMessage}
		</div>
	{/if}

	<!-- 核心进度卡片 + 今日一键打卡 -->
	<div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
		<div class="lg:col-span-7 rounded-2xl border border-(--line-divider) bg-(--card-bg) p-5 flex flex-col justify-between gap-4">
			<div class="flex items-start justify-between gap-3">
				<div>
					<div class="text-xs font-medium text-neutral-500 dark:text-neutral-400">
						{viewYear} 年 {viewMonth + 1} 月打卡进度
					</div>
					<div class="mt-1 flex items-baseline gap-2">
						<span class="text-4xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
							{monthCount}
						</span>
						<span class="text-lg font-medium text-neutral-500 dark:text-neutral-400">
							/ {store.targetDays} 天
						</span>
					</div>
				</div>

				{#if isMonthGoalMet}
					<span class="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
						本月已达标 🎉{monthCount > store.targetDays ? `（+${monthCount - store.targetDays}天）` : ""}
					</span>
				{:else if isViewingCurrentMonth && remainingToTarget > daysLeftInCurrentMonth}
					<span class="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-3 py-1 text-xs font-semibold text-red-600 dark:text-red-400">
						还差 {remainingToTarget} 天 · 本月仅剩 {daysLeftInCurrentMonth} 天
					</span>
				{:else if isViewingCurrentMonth}
					<span class="inline-flex items-center gap-1 rounded-full bg-(--primary)/15 px-3 py-1 text-xs font-semibold text-(--primary)">
						还差 {remainingToTarget} 天 · 本月余 {daysLeftInCurrentMonth} 天
					</span>
				{:else}
					<span class="inline-flex items-center gap-1 rounded-full bg-neutral-500/15 px-3 py-1 text-xs font-semibold text-neutral-600 dark:text-neutral-400">
						差 {remainingToTarget} 天未达标
					</span>
				{/if}
			</div>

			<div>
				<div class="h-3.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
					<div
						class={`h-full rounded-full transition-all duration-500 ${
							isMonthGoalMet ? "bg-emerald-500" : "bg-(--primary)"
						}`}
						style={`width: ${progressPercent}%`}
					></div>
				</div>
				<div class="mt-2 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
					<span>完成度 {progressPercent}%</span>
					<span>连续打卡 {currentStreak} 天 · {viewYear} 年已达标 {yearMetMonthsCount}/12 个月</span>
				</div>
			</div>
		</div>

		<!-- 今日一键打卡区 -->
		<div class="lg:col-span-5 rounded-2xl border border-(--line-divider) bg-(--card-bg) p-5 flex flex-col justify-between gap-3">
			<div class="flex items-center justify-between">
				<div>
					<div class="text-xs text-neutral-500 dark:text-neutral-400">今天 · {todayKey}</div>
					<div class="mt-0.5 text-base font-bold text-neutral-900 dark:text-neutral-100">
						{#if todayRecord}
							<span class="text-emerald-600 dark:text-emerald-400">今日已打卡 ({todayRecord.checkedAt})</span>
						{:else}
							尚未打卡
						{/if}
					</div>
				</div>
				{#if todayRecord}
					<button
						type="button"
						disabled={isSaving}
						onclick={() => void handleToggleDate(todayKey, "remove")}
						class="rounded-lg border border-(--line-divider) px-2.5 py-1 text-xs text-neutral-500 hover:border-red-400 hover:text-red-500 transition cursor-pointer"
					>
						撤销今日
					</button>
				{/if}
			</div>

			<div class="flex flex-wrap gap-1.5">
				{#each QUICK_NOTES as tag}
					<button
						type="button"
						onclick={() => {
							noteDraft = noteDraft === tag ? "" : tag;
						}}
						class={`rounded-md px-2 py-1 text-xs transition cursor-pointer ${
							noteDraft === tag
								? "bg-(--primary) text-white dark:text-black/80 font-medium"
								: "bg-(--btn-regular-bg) text-neutral-600 dark:text-neutral-300 hover:text-(--primary)"
						}`}
					>
						{tag}
					</button>
				{/each}
			</div>

			<div class="flex gap-2">
				<input
					type="text"
					maxlength="80"
					bind:value={noteDraft}
					placeholder="可选备注（如：早卡 / 外勤）"
					class="min-w-0 flex-1 rounded-xl border border-(--line-divider) bg-transparent px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:border-(--primary)"
				/>
				<button
					type="button"
					disabled={isSaving}
					onclick={handleCheckInToday}
					class={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition cursor-pointer ${
						todayRecord
							? "bg-emerald-500 text-white hover:bg-emerald-600"
							: "bg-(--primary) text-white dark:text-black/80 hover:opacity-90"
					} disabled:opacity-60`}
				>
					{todayRecord ? "更新今日" : "今日打卡"}
				</button>
			</div>
		</div>
	</div>

	<!-- 月度交互日历 -->
	<div class="rounded-2xl border border-(--line-divider) bg-(--card-bg) p-4 sm:p-5">
		<div class="flex flex-wrap items-center justify-between gap-3 mb-4">
			<div class="flex items-center gap-2">
				<button
					type="button"
					onclick={() => switchMonth(-1)}
					aria-label="上个月"
					class="h-8 w-8 rounded-lg border border-(--line-divider) flex items-center justify-center text-neutral-700 dark:text-neutral-200 hover:border-(--primary) hover:text-(--primary) transition cursor-pointer"
				>
					‹
				</button>
				<div class="min-w-28 text-center text-base font-bold text-neutral-900 dark:text-neutral-100">
					{viewYear} 年 {viewMonth + 1} 月
				</div>
				<button
					type="button"
					onclick={() => switchMonth(1)}
					aria-label="下个月"
					class="h-8 w-8 rounded-lg border border-(--line-divider) flex items-center justify-center text-neutral-700 dark:text-neutral-200 hover:border-(--primary) hover:text-(--primary) transition cursor-pointer"
				>
					›
				</button>
				{#if !isViewingCurrentMonth}
					<button
						type="button"
						onclick={jumpToToday}
						class="ml-1 rounded-lg bg-(--btn-regular-bg) px-2.5 py-1 text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:text-(--primary) transition cursor-pointer"
					>
						回到本月
					</button>
				{/if}
			</div>

			<div class="flex items-center gap-1 rounded-lg bg-(--btn-regular-bg) p-1 text-xs">
				<button
					type="button"
					onclick={() => (tapToToggle = true)}
					class={`rounded-md px-2.5 py-1 transition cursor-pointer ${
						tapToToggle
							? "bg-(--primary) text-white dark:text-black/80 font-medium"
							: "text-neutral-600 dark:text-neutral-300"
					}`}
				>
					点按直接打卡/取消
				</button>
				<button
					type="button"
					onclick={() => (tapToToggle = false)}
					class={`rounded-md px-2.5 py-1 transition cursor-pointer ${
						!tapToToggle
							? "bg-(--primary) text-white dark:text-black/80 font-medium"
							: "text-neutral-600 dark:text-neutral-300"
					}`}
				>
					仅选中写备注
				</button>
			</div>
		</div>

		<!-- 星期表头 -->
		<div class="grid grid-cols-7 gap-1.5 sm:gap-2 mb-2 text-center text-xs font-medium text-neutral-500 dark:text-neutral-400">
			{#each WEEKDAYS as dayName, idx}
				<div class={idx >= 5 ? "text-neutral-400 dark:text-neutral-500" : ""}>{dayName}</div>
			{/each}
		</div>

		<!-- 日历格子 -->
		<div class="grid grid-cols-7 gap-1.5 sm:gap-2">
			{#each calendarCells as cell}
				{@const entry = store.records[cell.dateKey]}
				{@const isSelected = selectedDateKey === cell.dateKey}
				<button
					type="button"
					onclick={() => handleCellClick(cell)}
					class={`relative min-h-14 sm:min-h-16 rounded-xl p-1.5 sm:p-2 flex flex-col items-start justify-between text-left transition cursor-pointer border ${
						entry
							? "bg-(--primary)/16 border-(--primary)/50 text-neutral-900 dark:text-neutral-100 hover:bg-(--primary)/24"
							: cell.isCurrentMonth
								? cell.isWeekend
									? "bg-neutral-100/60 dark:bg-neutral-800/35 border-(--line-divider) text-neutral-500 dark:text-neutral-400 hover:border-(--primary)/40"
									: "bg-transparent border-(--line-divider) text-neutral-800 dark:text-neutral-200 hover:border-(--primary)/40"
								: "bg-transparent border-transparent text-neutral-300 dark:text-neutral-700 hover:border-(--line-divider)"
					} ${cell.isToday ? "ring-2 ring-(--primary) ring-offset-1 ring-offset-(--card-bg)" : ""} ${
						isSelected ? "outline-2 outline-neutral-400/60 dark:outline-neutral-500/60" : ""
					}`}
				>
					<div class="w-full flex items-center justify-between gap-1">
						<span class={`text-xs sm:text-sm font-semibold ${cell.isToday ? "text-(--primary)" : ""}`}>
							{cell.day}
						</span>
						{#if entry}
							<span class="inline-flex h-4 w-4 items-center justify-center rounded-full bg-(--primary) text-[10px] font-bold text-white dark:text-black/80">
								✓
							</span>
						{/if}
					</div>

					{#if entry}
						<div class="w-full truncate text-[10px] leading-tight text-neutral-600 dark:text-neutral-300">
							{entry.note || entry.checkedAt}
						</div>
					{:else if cell.isToday}
						<div class="text-[10px] font-medium text-(--primary)">今天</div>
					{/if}
				</button>
			{/each}
		</div>

		<!-- 选中日期操作条 -->
		<div class="mt-4 pt-3 border-t border-(--line-divider) flex flex-wrap items-center justify-between gap-3">
			<div class="text-xs sm:text-sm text-neutral-600 dark:text-neutral-300">
				选中日期：<span class="font-semibold text-neutral-900 dark:text-neutral-100">{selectedDateKey}</span>
				{#if selectedRecord}
					<span class="ml-2 text-emerald-600 dark:text-emerald-400">
						已打卡（{selectedRecord.checkedAt}）
					</span>
				{:else}
					<span class="ml-2 text-neutral-400">未打卡</span>
				{/if}
			</div>

			<div class="flex flex-wrap items-center gap-2 w-full sm:w-auto">
				<input
					type="text"
					maxlength="80"
					bind:value={noteDraft}
					placeholder="为该日添加备注..."
					class="min-w-0 flex-1 sm:w-48 rounded-lg border border-(--line-divider) bg-transparent px-2.5 py-1.5 text-xs text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-(--primary)"
				/>
				<button
					type="button"
					disabled={isSaving}
					onclick={handleSaveNoteForSelected}
					class="rounded-lg bg-(--btn-regular-bg) px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:text-(--primary) transition cursor-pointer"
				>
					{selectedRecord ? "保存备注" : "补卡并保存"}
				</button>
				<button
					type="button"
					disabled={isSaving}
					onclick={() => void handleToggleDate(selectedDateKey)}
					class={`rounded-lg px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
						selectedRecord
							? "border border-red-400/40 text-red-500 hover:bg-red-500/10"
							: "bg-(--primary) text-white dark:text-black/80"
					}`}
				>
					{selectedRecord ? "取消打卡" : "补签这天"}
				</button>
			</div>
		</div>
	</div>

	<!-- 全年 12 个月达标概览 -->
	<div class="rounded-2xl border border-(--line-divider) bg-(--card-bg) p-4 sm:p-5">
		<div class="flex items-center justify-between mb-3">
			<h3 class="text-sm sm:text-base font-bold text-neutral-900 dark:text-neutral-100">
				{viewYear} 年各月达标统计（目标 ≥ {store.targetDays} 天）
			</h3>
			<span class="text-xs text-neutral-500 dark:text-neutral-400">点击月份可快速跳转</span>
		</div>
		<div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
			{#each yearlySummary as item}
				<button
					type="button"
					onclick={() => (viewMonth = item.monthIndex)}
					class={`rounded-xl border p-2.5 text-left transition cursor-pointer ${
						item.monthIndex === viewMonth
							? "border-(--primary) bg-(--primary)/10"
							: item.met
								? "border-emerald-500/35 bg-emerald-500/8 hover:border-emerald-500/60"
								: "border-(--line-divider) hover:border-(--primary)/40"
					}`}
				>
					<div class="flex items-center justify-between text-xs">
						<span class="font-semibold text-neutral-800 dark:text-neutral-200">
							{item.label}
						</span>
						{#if item.met}
							<span class="text-emerald-600 dark:text-emerald-400 font-bold">✓</span>
						{:else if item.isCurrent}
							<span class="text-[10px] text-(--primary)">本月</span>
						{/if}
					</div>
					<div class="mt-1 text-sm font-bold text-neutral-900 dark:text-neutral-100">
						{item.count}
						<span class="text-[11px] font-normal text-neutral-500">/ {store.targetDays}</span>
					</div>
				</button>
			{/each}
		</div>
	</div>

	<!-- 备份工具栏 -->
	<div class="flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-500 dark:text-neutral-400 px-1">
		<div>
			共累计记录 {Object.keys(store.records).length} 天 · 最近更新 {store.updatedAt ? new Date(store.updatedAt).toLocaleString("zh-CN") : "-"}
		</div>
		<div class="flex items-center gap-2">
			<button
				type="button"
				onclick={exportJson}
				class="rounded-lg border border-(--line-divider) px-2.5 py-1 hover:border-(--primary) hover:text-(--primary) transition cursor-pointer"
			>
				导出 JSON 备份
			</button>
			<button
				type="button"
				onclick={() => fileInputEl?.click()}
				class="rounded-lg border border-(--line-divider) px-2.5 py-1 hover:border-(--primary) hover:text-(--primary) transition cursor-pointer"
			>
				导入恢复
			</button>
			<input
				bind:this={fileInputEl}
				type="file"
				accept="application/json"
				onchange={handleImportFile}
				class="hidden"
			/>
		</div>
	</div>
</div>
