import type { SearchResult } from "@/global";
import { url } from "@/utils/url-utils";

export type DevSearchDocument = {
	title: string;
	description: string;
	tags: string[];
	category: string;
	content: string;
	published: number;
	url: string;
};

const MAX_RESULTS = 50;
const MAX_QUERY_LENGTH = 100;
let documentsPromise: Promise<DevSearchDocument[]> | undefined;

const loadDocuments = async (): Promise<DevSearchDocument[]> => {
	if (!documentsPromise) {
		documentsPromise = fetch(url("/api/dev-search.json"))
			.then(async (response) => {
				if (!response.ok) {
					throw new Error(`开发环境搜索索引请求失败：${response.status}`);
				}
				return (await response.json()) as DevSearchDocument[];
			})
			.catch((error) => {
				documentsPromise = undefined;
				throw error;
			});
	}

	return documentsPromise;
};

const escapeRegExp = (value: string): string =>
	value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const escapeHtml = (value: string): string =>
	value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");

const getQueryTerms = (query: string): string[] => [
	...new Set(query.toLocaleLowerCase().split(/\s+/).filter(Boolean)),
];

const highlight = (value: string, terms: string[]): string => {
	if (!value || terms.length === 0) return escapeHtml(value);

	const pattern = new RegExp(
		terms
			.sort((a, b) => b.length - a.length)
			.map(escapeRegExp)
			.join("|"),
		"gi",
	);
	let highlighted = "";
	let lastIndex = 0;

	for (const match of value.matchAll(pattern)) {
		const index = match.index ?? 0;
		highlighted += escapeHtml(value.slice(lastIndex, index));
		highlighted += `<mark>${escapeHtml(match[0])}</mark>`;
		lastIndex = index + match[0].length;
	}

	return highlighted + escapeHtml(value.slice(lastIndex));
};

const createExcerpt = (value: string, terms: string[]): string => {
	const text = value.trim();
	if (!text) return "";

	const lowerText = text.toLocaleLowerCase();
	const matchIndex = terms
		.map((term) => lowerText.indexOf(term))
		.filter((index) => index >= 0)
		.sort((a, b) => a - b)[0];

	if (matchIndex === undefined) {
		return highlight(text.slice(0, 180), terms);
	}

	const start = Math.max(0, matchIndex - 80);
	const end = Math.min(text.length, matchIndex + 140);
	const prefix = start > 0 ? "..." : "";
	const suffix = end < text.length ? "..." : "";
	return `${prefix}${highlight(text.slice(start, end), terms)}${suffix}`;
};

const scoreDocument = (
	document: DevSearchDocument,
	terms: string[],
): number => {
	const fields = [
		{ value: document.title, weight: 100 },
		{ value: document.description, weight: 45 },
		{ value: document.tags.join(" "), weight: 35 },
		{ value: document.category, weight: 25 },
		{ value: document.content, weight: 10 },
	];

	return terms.reduce(
		(score, term) =>
			score +
			fields.reduce(
				(fieldScore, field) =>
					fieldScore +
					(field.value.toLocaleLowerCase().includes(term) ? field.weight : 0),
				0,
			),
		0,
	);
};

export async function searchDevPosts(keyword: string): Promise<SearchResult[]> {
	const query = keyword.trim().slice(0, MAX_QUERY_LENGTH);
	const terms = getQueryTerms(query);
	if (terms.length === 0) return [];

	const documents = await loadDocuments();
	return documents
		.map((document) => ({ document, score: scoreDocument(document, terms) }))
		.filter(({ score }) => score > 0)
		.sort(
			(a, b) =>
				b.score - a.score || b.document.published - a.document.published,
		)
		.slice(0, MAX_RESULTS)
		.map(({ document }) => {
			const descriptionMatches = terms.some((term) =>
				document.description.toLocaleLowerCase().includes(term),
			);
			const excerptSource = descriptionMatches
				? document.description
				: document.content || document.description;
			const contentExcerpt = createExcerpt(document.content, terms);

			return {
				url: url(document.url),
				meta: { title: highlight(document.title, terms) },
				excerpt: createExcerpt(excerptSource || document.title, terms),
				...(contentExcerpt && document.content
					? { content: contentExcerpt }
					: {}),
			} satisfies SearchResult;
		});
}
