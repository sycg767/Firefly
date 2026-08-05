import { getSortedPosts } from "@/utils/content-utils";
import type { DevSearchDocument } from "@/utils/dev-search";
import { getPostUrlBySlug } from "@/utils/url-utils";

export const prerender = true;

const toSearchText = (value: string): string =>
	value
		.replace(/```[^\n]*\n?/g, "")
		.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
		.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
		.replace(/<[^>]+>/g, " ")
		.replace(/(^|\s)#{1,6}\s+/gm, "$1")
		.replace(/[*_`~]/g, "")
		.replace(/\s+/g, " ")
		.trim();

export async function GET(): Promise<Response> {
	const posts = await getSortedPosts();
	const documents: DevSearchDocument[] = posts.map((post) => ({
		title: post.data.title,
		description: post.data.description || "",
		tags: post.data.tags,
		category: post.data.category || "",
		content: toSearchText(post.body || ""),
		published: post.data.published.getTime(),
		url: getPostUrlBySlug(post.id),
	}));

	return new Response(JSON.stringify(documents), {
		headers: { "Content-Type": "application/json; charset=utf-8" },
	});
}
