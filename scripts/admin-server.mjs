import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ADMIN_DIST = path.join(ROOT, "admin", "dist");
const ADMIN_LEGACY_PAGE = path.join(ROOT, "admin", "legacy-index.html");
const ADMIN_PAGE = path.join(ROOT, "admin", "index.html");
const POSTS_DIR = path.join(ROOT, "src", "content", "posts");
const CONTENT_DIR = path.join(ROOT, "src", "content");
const SRC_IMAGES_DIR = path.join(ROOT, "src", "assets", "images");
const PUBLIC_ASSETS_DIR = path.join(ROOT, "public", "assets");
const PUBLIC_IMAGES_DIR = path.join(PUBLIC_ASSETS_DIR, "images");
const PUBLIC_FAVICON_DIR = path.join(ROOT, "public", "favicon");
const PUBLIC_MUSIC_COVER_DIR = path.join(ROOT, "public", "assets", "music", "cover");
const GALLERY_DIR = path.join(ROOT, "public", "gallery");
const SITE_CONFIG = path.join(ROOT, "src", "config", "siteConfig.ts");
const PROFILE_CONFIG = path.join(ROOT, "src", "config", "profileConfig.ts");
const WALLPAPER_CONFIG = path.join(ROOT, "src", "config", "backgroundWallpaper.ts");
const ABOUT_PAGE = path.join(ROOT, "src", "content", "spec", "about.md");
const GUESTBOOK_PAGE = path.join(ROOT, "src", "content", "spec", "guestbook.md");
const ANNOUNCEMENT_CONFIG = path.join(ROOT, "src", "config", "announcementConfig.ts");
const COMMENT_CONFIG = path.join(ROOT, "src", "config", "commentConfig.ts");
const EFFECTS_CONFIG = path.join(ROOT, "src", "config", "effectsConfig.ts");
const MUSIC_CONFIG = path.join(ROOT, "src", "config", "musicConfig.ts");
const SIDEBAR_CONFIG = path.join(ROOT, "src", "config", "sidebarConfig.ts");
const SPONSOR_CONFIG = path.join(ROOT, "src", "config", "sponsorConfig.ts");
const FRIENDS_CONFIG = path.join(ROOT, "src", "config", "friendsConfig.ts");
const FOOTER_CONFIG = path.join(ROOT, "src", "config", "footerConfig.ts");
const FRIENDS_PAGE = path.join(ROOT, "src", "content", "spec", "friends.mdx");
const FOOTER_HTML = path.join(ROOT, "src", "config", "FooterConfig.html");
const CONFIG_RUNTIME = path.join(ROOT, "scripts", "admin-config-runtime.ts");
const PORT = Number(process.env.FIREFLY_ADMIN_PORT || 3100);
const COMMAND = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

let runningTask = null;

const jsonHeaders = {
	"Content-Type": "application/json; charset=utf-8",
	"Cache-Control": "no-store",
};

const IMAGE_MIME_TYPES = {
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	png: "image/png",
	webp: "image/webp",
	avif: "image/avif",
	gif: "image/gif",
	svg: "image/svg+xml",
};

function sendJson(res, status, data) {
	res.writeHead(status, jsonHeaders);
	res.end(JSON.stringify(data));
}

function sendError(res, error) {
	const message = error instanceof Error ? error.message : String(error);
	sendJson(res, 400, { ok: false, error: message });
}

async function readText(file) {
	return fs.readFile(file, "utf8");
}

async function writeText(file, text) {
	await fs.writeFile(file, text, "utf8");
}

function extensionForMime(mime) {
	return Object.entries(IMAGE_MIME_TYPES).find(([, type]) => type === mime)?.[0] || "";
}

function safeAlbumId(value) {
	const id = String(value || "").trim();
	if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(id)) throw new Error("相册 ID 只能使用英文、数字、短横线和下划线");
	return id;
}

function safeMediaFilename(value, fallbackExtension = "") {
	const original = path.basename(String(value || "")).trim();
	const extension = path.extname(original).slice(1).toLowerCase() || fallbackExtension;
	if (!IMAGE_MIME_TYPES[extension]) throw new Error("只支持 JPG、PNG、WebP、AVIF、GIF 和 SVG 图片");
	const base = path.basename(original, path.extname(original)).replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-{2,}/g, "-").replace(/^-+|-+$/g, "") || "photo";
	return `${base.slice(0, 70)}.${extension}`;
}

function parseImageData(dataUrl) {
	const match = String(dataUrl || "").match(/^data:(image\/(?:jpeg|png|webp|avif|gif|svg\+xml));base64,([A-Za-z0-9+/=\s]+)$/i);
	if (!match) throw new Error("请选择 JPG、PNG、WebP、AVIF、GIF 或 SVG 图片");
	const mime = match[1].toLowerCase();
	const buffer = Buffer.from(match[2].replace(/\s/g, ""), "base64");
	if (!buffer.length || buffer.length > 8 * 1024 * 1024) throw new Error("图片大小不能超过 8 MB");
	return { buffer, extension: extensionForMime(mime) };
}

function mediaPathInside(root, ...parts) {
	const target = path.resolve(root, ...parts);
	const rootPrefix = `${path.resolve(root)}${path.sep}`;
	if (!target.startsWith(rootPrefix)) throw new Error("媒体文件路径不合法");
	return target;
}

function localAvatarPath(profilePath) {
	const value = String(profilePath || "").replace(/^\/+/, "");
	if (value.startsWith("assets/images/")) return mediaPathInside(SRC_IMAGES_DIR, value.slice("assets/images/".length));
	if (value.startsWith("assets\\images\\")) return mediaPathInside(SRC_IMAGES_DIR, value.slice("assets\\images\\".length));
	if (value.startsWith("public/assets/")) return mediaPathInside(ROOT, value);
	return null;
}

async function existingMediaFiles(directory) {
	if (!await fs.stat(directory).catch(() => null)) return [];
	const entries = await fs.readdir(directory, { withFileTypes: true });
	return entries.filter((entry) => entry.isFile() && IMAGE_MIME_TYPES[path.extname(entry.name).slice(1).toLowerCase()]).map((entry) => entry.name).sort((a, b) => {
		if (/^cover\./i.test(a)) return -1;
		if (/^cover\./i.test(b)) return 1;
		return a.localeCompare(b);
	});
}

async function walkImageFiles(directory, relative = "") {
	if (!await fs.stat(directory).catch(() => null)) return [];
	const entries = await fs.readdir(directory, { withFileTypes: true });
	const result = [];
	for (const entry of entries) {
		const entryRelative = path.posix.join(relative, entry.name);
		if (entry.isDirectory()) result.push(...await walkImageFiles(path.join(directory, entry.name), entryRelative));
		else if (entry.isFile() && IMAGE_MIME_TYPES[path.extname(entry.name).slice(1).toLowerCase()]) result.push(entryRelative);
	}
	return result;
}

function mediaLibraryUrl(rootKey, relative) {
	return `/media/library?root=${encodeURIComponent(rootKey)}&path=${encodeURIComponent(relative.replaceAll(path.sep, "/"))}`;
}

function mediaGroupForSource(file, source) {
	if (source === "content") return "文章图片";
	if (source === "src-images") {
		if (/^DesktopWallpaper\//i.test(file)) return "桌面壁纸";
		if (/^MobileWallpaper\//i.test(file)) return "移动壁纸";
		if (/^logo\//i.test(file)) return "网站 Logo";
		if (/^avatar\./i.test(file)) return "头像";
		return "src 图片";
	}
	if (/^assets\/images\/managed\//i.test(file)) return "已上传图片";
	if (/^assets\/images\/sponsor\//i.test(file)) return "打赏图片";
	if (/^assets\/images\/ad\//i.test(file)) return "广告图片";
	if (/^assets\/music\/cover\//i.test(file)) return "音乐封面";
	if (/^favicon\//i.test(file)) return "网站图标";
	if (/^pio\//i.test(file)) return "看板娘资源";
	return "public 图片";
}

async function readMediaLibrary() {
	const srcFiles = await walkImageFiles(SRC_IMAGES_DIR);
	const contentFiles = await walkImageFiles(CONTENT_DIR);
	const publicFiles = (await walkImageFiles(path.join(ROOT, "public"))).filter((file) => !file.startsWith("gallery/"));
	return [
		...srcFiles.map((file) => ({
			name: path.basename(file),
			path: `assets/images/${file}`,
			url: mediaLibraryUrl("src-images", file),
			group: mediaGroupForSource(file, "src-images"),
			managed: false,
		})),
		...contentFiles.map((file) => ({
			name: path.basename(file),
			path: `src/content/${file}`,
			url: mediaLibraryUrl("content", file),
			group: mediaGroupForSource(file, "content"),
			managed: false,
			selectable: false,
		})),
		...publicFiles.map((file) => ({
			name: path.basename(file),
			path: `/${file.replaceAll(path.sep, "/")}`,
			url: mediaLibraryUrl("public", file),
			group: mediaGroupForSource(file, "public"),
			managed: file.startsWith("assets/images/managed/"),
		})),
	].sort((a, b) => a.path.localeCompare(b.path));
}

function decodeString(raw) {
	try {
		return JSON.parse(`"${raw}"`);
	} catch {
		return raw;
	}
}

function readScalar(text, key) {
	const match = text.match(new RegExp(`^\\s*${key}:\\s*"((?:\\\\.|[^"])*)"`, "m"));
	return match ? decodeString(match[1]) : "";
}

function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findObjectBlock(text, name) {
	const marker = new RegExp(`\\b${escapeRegExp(name)}\\s*:\\s*\\{`).exec(text);
	if (!marker) return null;
	const start = marker.index;
	const braceStart = start + marker[0].lastIndexOf("{");
	let depth = 0;
	let quote = false;
	let escaped = false;
	for (let index = braceStart; index < text.length; index += 1) {
		const char = text[index];
		if (quote) {
			if (escaped) escaped = false;
			else if (char === "\\") escaped = true;
			else if (char === '"') quote = false;
			continue;
		}
		if (char === '"') quote = true;
		else if (char === "{") depth += 1;
		else if (char === "}" && --depth === 0) return { start, end: index + 1, block: text.slice(start, index + 1) };
	}
	return null;
}

function readObjectField(text, objectName, key) {
	const object = findObjectBlock(text, objectName);
	if (!object) return undefined;
	const pattern = new RegExp(`^\\s*${escapeRegExp(key)}:\\s*(?:"((?:\\\\.|[^"])*)"|(true|false)|(-?\\d+(?:\\.\\d+)?))`, "m");
	const match = pattern.exec(object.block);
	if (!match) return undefined;
	if (match[1] !== undefined) return decodeString(match[1]);
	if (match[2] !== undefined) return match[2] === "true";
	return Number(match[3]);
}

function fieldValue(value) {
	if (typeof value === "boolean") return String(value);
	if (typeof value === "number" && Number.isFinite(value)) return String(value);
	return JSON.stringify(String(value ?? ""));
}

function replaceObjectField(text, objectName, key, value) {
	const object = findObjectBlock(text, objectName);
	if (!object) return text;
	const pattern = new RegExp(`(^\\s*${escapeRegExp(key)}:\\s*)(?:"(?:\\\\.|[^"])*"|true|false|-?\\d+(?:\\.\\d+)?)`, "m");
	const nextBlock = object.block.replace(pattern, (_, prefix) => `${prefix}${fieldValue(value)}`);
	return `${text.slice(0, object.start)}${nextBlock}${text.slice(object.end)}`;
}

function readArray(text, key) {
	const match = text.match(new RegExp(`^\\s*${key}:\\s*\\[([\\s\\S]*?)^\\s*\\],`, "m"));
	if (!match) return [];
	return [...match[1].matchAll(/"((?:\\.|[^"])*)"/g)].map((item) => decodeString(item[1]));
}

function readLinks(text) {
	const match = text.match(/^\s*links:\s*\[([\s\S]*?)^\s*\],/m);
	if (!match) return [];
	return [...match[1].matchAll(/\{\s*name:\s*"((?:\\.|[^"])*)",\s*icon:\s*"((?:\\.|[^"])*)",\s*url:\s*"((?:\\.|[^"])*)",\s*showName:\s*(true|false),\s*\}/g)].map((item) => ({
		name: decodeString(item[1]),
		icon: decodeString(item[2]),
		url: decodeString(item[3]),
		showName: item[4] === "true",
	}));
}

function replaceScalar(text, key, value) {
	const pattern = new RegExp(`(^\\s*${key}:\\s*)"(?:\\\\.|[^"])*"`, "m");
	return text.replace(pattern, (_, prefix) => `${prefix}${JSON.stringify(String(value ?? ""))}`);
}

function replaceDescription(text, value) {
	const pattern = /(^\s*description:\s*)(?:\r?\n\s*)?"(?:\\.|[^"])*"/m;
	return text.replace(pattern, (_, prefix) => `${prefix}${JSON.stringify(String(value ?? ""))}`);
}

function replaceArray(text, key, values) {
	const pattern = new RegExp(`(^\\s*${key}:\\s*)\\[[\\s\\S]*?^\\s*\\],`, "m");
	const body = values.map((value) => `\n\t\t${JSON.stringify(String(value))},`).join("");
	return text.replace(pattern, (_, prefix) => `${prefix}[${body}\n\t],`);
}

function replaceLinks(text, links) {
	const pattern = /^\s*links:\s*\[[\s\S]*?^\s*\],/m;
	const body = links.map((link) => [
		"\t\t{",
		`\t\t\tname: ${JSON.stringify(String(link.name || ""))},`,
		`\t\t\ticon: ${JSON.stringify(String(link.icon || "material-symbols:link"))},`,
		`\t\t\turl: ${JSON.stringify(String(link.url || ""))},`,
		`\t\t\tshowName: ${Boolean(link.showName)},`,
		"\t\t},",
	].join("\n")).join("\n");
	return text.replace(pattern, `\tlinks: [\n${body}\n\t],`);
}

function readHomeSettings(text) {
	const block = text.match(/homeText:\s*\{([\s\S]*?)\n\s*\},\n\s*\/\/ 文章横幅信息/);
	if (!block) return { title: "", subtitles: [] };
	const title = readScalar(block[1], "title");
	const subtitleMatch = block[1].match(/^\s*subtitle:\s*\[([\s\S]*?)^\s*\],/m);
	const subtitles = subtitleMatch
		? [...subtitleMatch[1].matchAll(/"((?:\\.|[^"])*)"/g)].map((item) => decodeString(item[1]))
		: [];
	return { title, subtitles };
}

function replaceHomeSettings(text, title, subtitles) {
	const homePattern = /(homeText:\s*\{[\s\S]*?)(\n\s*\},\n\s*\/\/ 文章横幅信息)/;
	return text.replace(homePattern, (_, block, suffix) => {
		const nextBlock = replaceScalar(block, "title", title);
		const subtitlePattern = /(^\s*subtitle:\s*)\[[\s\S]*?^\s*\],/m;
		const subtitleBody = subtitles.map((item) => `\n\t\t\t\t${JSON.stringify(String(item))},`).join("");
		return `${nextBlock.replace(subtitlePattern, (_, prefix) => `${prefix}[${subtitleBody}\n\t\t\t],`)}${suffix}`;
	});
}

async function readConfig() {
	const [siteText, profileText, wallpaperText] = await Promise.all([
		readText(SITE_CONFIG),
		readText(PROFILE_CONFIG),
		readText(WALLPAPER_CONFIG),
	]);
	return {
		site: {
			title: readScalar(siteText, "title"),
			subtitle: readScalar(siteText, "subtitle"),
			siteUrl: readScalar(siteText, "site_url"),
			description: readDescription(siteText),
			keywords: readArray(siteText, "keywords"),
			siteStartDate: readScalar(siteText, "siteStartDate"),
			appearance: {
				themeHue: readObjectField(siteText, "themeColor", "hue"),
				defaultMode: readObjectField(siteText, "themeColor", "defaultMode"),
				pageWidth: readScalarNumber(siteText, "pageWidth"),
				cardBorder: readObjectField(siteText, "card", "border"),
				cardFollowTheme: readObjectField(siteText, "card", "followTheme"),
				layout: readObjectField(siteText, "postListLayout", "defaultMode"),
				mobileLayout: readObjectField(siteText, "postListLayout", "mobileDefaultMode"),
				coverPosition: readObjectField(siteText, "postListLayout", "coverPosition"),
				categoryBar: readScalarBoolean(siteText, "categoryBar"),
				foldArticle: readScalarBoolean(siteText, "foldArticle"),
				pages: readPageSwitches(siteText),
			},
		},
		profile: {
			avatar: readScalar(profileText, "avatar"),
			name: readScalar(profileText, "name"),
			bio: readScalar(profileText, "bio"),
			links: readLinks(profileText),
		},
		home: readHomeSettings(wallpaperText),
		background: {
			mode: readScalar(wallpaperText, "mode"),
			playerEnable: readScalarBoolean(wallpaperText, "playerEnable"),
			dimOpacity: readObjectField(wallpaperText, "common", "dimOpacity"),
			transparentMode: readObjectField(wallpaperText, "navbar", "transparentMode"),
			blur: readObjectField(wallpaperText, "navbar", "blur"),
		},
		features: await readFeatures(),
	};
}

function readScalarNumber(text, key) {
	const match = text.match(new RegExp(`^\\s*${escapeRegExp(key)}:\\s*(-?\\d+(?:\\.\\d+)?)`, "m"));
	return match ? Number(match[1]) : undefined;
}

function readScalarBoolean(text, key) {
	const match = text.match(new RegExp(`^\\s*${escapeRegExp(key)}:\\s*(true|false)`, "m"));
	return match ? match[1] === "true" : undefined;
}

function readPageSwitches(text) {
	const object = findObjectBlock(text, "pages");
	if (!object) return {};
	const result = {};
	for (const key of ["friends", "sponsor", "guestbook", "bangumi", "gallery", "anime", "dynamic", "booknav"]) {
		const match = object.block.match(new RegExp(`^\\s*${escapeRegExp(key)}:\\s*(true|false)`, "m"));
		if (match) result[key] = match[1] === "true";
	}
	return result;
}

function readDescription(text) {
	const match = text.match(/^\s*description:\s*(?:\r?\n\s*)?"((?:\\.|[^"])*)"/m);
	return match ? decodeString(match[1]) : "";
}

function readTextValue(text, key) {
	const match = text.match(new RegExp(`^\\s*${escapeRegExp(key)}:\\s*(?:\\r?\\n\\s*)?"((?:\\\\.|[^"])*)"`, "m"));
	return match ? decodeString(match[1]) : "";
}

function replaceTextValue(text, key, value) {
	const pattern = new RegExp(`(^\\s*${escapeRegExp(key)}:\\s*)(?:\\r?\\n\\s*)?"(?:\\\\.|[^"])*"`, "m");
	return text.replace(pattern, (_, prefix) => `${prefix}${JSON.stringify(String(value ?? ""))}`);
}

async function readFeatures() {
	const [announcement, comment, effects, music, sidebar, sponsor, friends, footer] = await Promise.all([
		readText(ANNOUNCEMENT_CONFIG),
		readText(COMMENT_CONFIG),
		readText(EFFECTS_CONFIG),
		readText(MUSIC_CONFIG),
		readText(SIDEBAR_CONFIG),
		readText(SPONSOR_CONFIG),
		readText(FRIENDS_CONFIG),
		readText(FOOTER_CONFIG),
	]);
	return {
		announcement: {
			title: readScalar(announcement, "title"),
			content: readTextValue(announcement, "content"),
			closable: readScalarBoolean(announcement, "closable"),
			linkEnable: readObjectField(announcement, "link", "enable"),
			linkText: readScalar(announcement, "text"),
			linkUrl: readScalar(announcement, "url"),
			linkExternal: readScalarBoolean(announcement, "external"),
		},
		comments: {
			type: readScalar(comment, "type"),
			twikooEnvId: readScalar(comment, "envId"),
			walineServerUrl: readScalar(comment, "serverURL"),
		},
		effects: {
			sakuraEnable: readScalarBoolean(effects, "enable"),
			sakuraNum: readScalarNumber(effects, "sakuraNum"),
		},
		music: {
			showInNavbar: readScalarBoolean(music, "showInNavbar"),
			showInSidebar: readScalarBoolean(music, "showInSidebar"),
			mode: readScalar(music, "mode"),
			volume: readScalarNumber(music, "volume"),
			playMode: readScalar(music, "playMode"),
			showLyrics: readScalarBoolean(music, "showLyrics"),
			metingServer: readObjectField(music, "meting", "server"),
			metingType: readObjectField(music, "meting", "type"),
			metingId: readObjectField(music, "meting", "id"),
		},
		sidebar: {
			enable: readScalarBoolean(sidebar, "enable"),
			position: readScalar(sidebar, "position"),
			tabletSidebar: readScalar(sidebar, "tabletSidebar"),
			hideOnPost: readScalarBoolean(sidebar, "hideSidebarOnPostPage"),
			showBothOnPost: readScalarBoolean(sidebar, "showBothSidebarsOnPostPage"),
		},
		sponsor: {
			title: readScalar(sponsor, "title"),
			description: readScalar(sponsor, "description"),
			usage: readTextValue(sponsor, "usage"),
			showList: readScalarBoolean(sponsor, "showSponsorsList"),
			showComment: readScalarBoolean(sponsor, "showComment"),
			showButton: readScalarBoolean(sponsor, "showButtonInPost"),
		},
		friends: {
			title: readScalar(friends, "title"),
			description: readScalar(friends, "description"),
			showCustomContent: readScalarBoolean(friends, "showCustomContent"),
			showComment: readScalarBoolean(friends, "showComment"),
			randomizeSort: readScalarBoolean(friends, "randomizeSort"),
		},
		footer: { enable: readScalarBoolean(footer, "enable") },
	};
}

async function saveFeatures(features) {
	const data = features || {};
	const files = await Promise.all([
		readText(ANNOUNCEMENT_CONFIG),
		readText(COMMENT_CONFIG),
		readText(EFFECTS_CONFIG),
		readText(MUSIC_CONFIG),
		readText(SIDEBAR_CONFIG),
		readText(SPONSOR_CONFIG),
		readText(FRIENDS_CONFIG),
		readText(FOOTER_CONFIG),
	]);
	let [announcement, comment, effects, music, sidebar, sponsor, friends, footer] = files;
	const update = (text, values) => {
		let next = text;
		for (const [key, value] of Object.entries(values)) {
			if (value === undefined) continue;
			next = ["enable", "closable", "external", "showInNavbar", "showInSidebar", "showLyrics", "showSponsorsList", "showComment", "showButtonInPost", "showCustomContent", "randomizeSort", "hideSidebarOnPostPage", "showBothSidebarsOnPostPage"].includes(key)
				? replaceScalarValue(next, key, Boolean(value))
				: typeof value === "number"
					? replaceScalarValue(next, key, value)
					: replaceTextValue(next, key, value);
		}
		return next;
	};
	const a = data.announcement || {};
	announcement = update(announcement, { title: a.title, content: a.content, closable: a.closable, text: a.linkText, url: a.linkUrl, external: a.linkExternal });
	if (a.linkEnable !== undefined) announcement = replaceObjectField(announcement, "link", "enable", Boolean(a.linkEnable));
	const c = data.comments || {};
	comment = update(comment, { type: c.type, envId: c.twikooEnvId, serverURL: c.walineServerUrl });
	const e = data.effects || {};
	effects = update(effects, { enable: e.sakuraEnable, sakuraNum: e.sakuraNum });
	const m = data.music || {};
	music = update(music, { showInNavbar: m.showInNavbar, showInSidebar: m.showInSidebar, mode: m.mode, volume: m.volume, playMode: m.playMode, showLyrics: m.showLyrics });
	for (const [key, value] of [["server", m.metingServer], ["type", m.metingType], ["id", m.metingId]]) if (value !== undefined) music = replaceObjectField(music, "meting", key, value);
	const s = data.sidebar || {};
	sidebar = update(sidebar, { enable: s.enable, position: s.position, tabletSidebar: s.tabletSidebar, hideSidebarOnPostPage: s.hideOnPost, showBothSidebarsOnPostPage: s.showBothOnPost });
	const sp = data.sponsor || {};
	sponsor = update(sponsor, { title: sp.title, description: sp.description, usage: sp.usage, showSponsorsList: sp.showList, showComment: sp.showComment, showButtonInPost: sp.showButton });
	const f = data.friends || {};
	friends = update(friends, { title: f.title, description: f.description, showCustomContent: f.showCustomContent, showComment: f.showComment, randomizeSort: f.randomizeSort });
	footer = update(footer, { enable: data.footer?.enable });
	await Promise.all([
		writeText(ANNOUNCEMENT_CONFIG, announcement), writeText(COMMENT_CONFIG, comment), writeText(EFFECTS_CONFIG, effects), writeText(MUSIC_CONFIG, music),
		writeText(SIDEBAR_CONFIG, sidebar), writeText(SPONSOR_CONFIG, sponsor), writeText(FRIENDS_CONFIG, friends), writeText(FOOTER_CONFIG, footer),
	]);
}

async function readPages() {
	const [aboutSource, guestbookSource, friendsSource, footerHtml] = await Promise.all([
		readText(ABOUT_PAGE),
		readText(GUESTBOOK_PAGE),
		readText(FRIENDS_PAGE),
		readText(FOOTER_HTML),
	]);
	const guestbook = matter(guestbookSource);
	return {
		about: { body: aboutSource.trimStart() },
		guestbook: {
			title: String(guestbook.data.title || ""),
			description: String(guestbook.data.description || ""),
			body: guestbook.content.trimStart(),
		},
		friends: { body: friendsSource.trimStart() },
		footer: { html: footerHtml },
	};
}

async function savePages(data) {
	const pages = data || {};
	if (pages.about?.body !== undefined) {
		await writeText(ABOUT_PAGE, `${String(pages.about.body).trimEnd()}\n`);
	}
	if (pages.friends?.body !== undefined) {
		await writeText(FRIENDS_PAGE, `${String(pages.friends.body).trimEnd()}\n`);
	}
	if (pages.footer?.html !== undefined) {
		await writeText(FOOTER_HTML, String(pages.footer.html));
	}
	if (pages.guestbook) {
		const current = matter(await readText(GUESTBOOK_PAGE));
		const title = pages.guestbook.title ?? current.data.title ?? "留言板";
		const description = pages.guestbook.description ?? current.data.description ?? "";
		const body = String(pages.guestbook.body ?? current.content).trim().replace(/\s+$/, "");
		await writeText(GUESTBOOK_PAGE, ["---", `title: ${quote(title)}`, `description: ${quote(description)}`, "---", "", body, ""].join("\n"));
	}
}

function replaceScalarValue(text, key, value) {
	const pattern = new RegExp(`(^\\s*${escapeRegExp(key)}:\\s*)(?:"(?:\\\\.|[^"])*"|true|false|-?\\d+(?:\\.\\d+)?)`, "m");
	return text.replace(pattern, (_, prefix) => `${prefix}${fieldValue(value)}`);
}

async function saveConfig(data) {
	const [siteText, profileText, wallpaperText] = await Promise.all([
		readText(SITE_CONFIG),
		readText(PROFILE_CONFIG),
		readText(WALLPAPER_CONFIG),
	]);
	const site = data.site || {};
	const profile = data.profile || {};
	const home = data.home || {};
	const appearance = site.appearance || {};
	const background = data.background || {};

	let nextSite = siteText;
	for (const [key, value] of [["title", site.title], ["subtitle", site.subtitle], ["site_url", site.siteUrl], ["siteStartDate", site.siteStartDate]]) {
		if (value !== undefined) nextSite = replaceScalar(nextSite, key, value);
	}
	if (site.description !== undefined) nextSite = replaceDescription(nextSite, site.description);
	if (Array.isArray(site.keywords)) nextSite = replaceArray(nextSite, "keywords", site.keywords);
	for (const [key, value] of [["hue", appearance.themeHue], ["defaultMode", appearance.defaultMode]]) {
		if (value !== undefined) nextSite = replaceObjectField(nextSite, "themeColor", key, value);
	}
	if (appearance.pageWidth !== undefined) nextSite = replaceScalarValue(nextSite, "pageWidth", Number(appearance.pageWidth));
	for (const [key, value] of [["border", appearance.cardBorder], ["followTheme", appearance.cardFollowTheme]]) {
		if (value !== undefined) nextSite = replaceObjectField(nextSite, "card", key, Boolean(value));
	}
	for (const [key, value] of [["defaultMode", appearance.layout], ["mobileDefaultMode", appearance.mobileLayout], ["coverPosition", appearance.coverPosition]]) {
		if (value !== undefined) nextSite = replaceObjectField(nextSite, "postListLayout", key, value);
	}
	for (const [key, value] of [["categoryBar", appearance.categoryBar], ["foldArticle", appearance.foldArticle]]) {
		if (value !== undefined) nextSite = replaceScalarValue(nextSite, key, Boolean(value));
	}
	for (const [key, value] of Object.entries(appearance.pages || {})) {
		if (value !== undefined) nextSite = replaceObjectField(nextSite, "pages", key, Boolean(value));
	}

	let nextProfile = profileText;
	for (const [key, value] of [["avatar", profile.avatar], ["name", profile.name], ["bio", profile.bio]]) {
		if (value !== undefined) nextProfile = replaceScalar(nextProfile, key, value);
	}
	if (Array.isArray(profile.links)) nextProfile = replaceLinks(nextProfile, profile.links);

	let nextWallpaper = replaceHomeSettings(
		wallpaperText,
		home.title ?? readHomeSettings(wallpaperText).title,
		Array.isArray(home.subtitles) ? home.subtitles : readHomeSettings(wallpaperText).subtitles,
	);
	for (const [key, value] of [["mode", background.mode], ["playerEnable", background.playerEnable]]) {
		if (value !== undefined) nextWallpaper = replaceScalarValue(nextWallpaper, key, value);
	}
	for (const [objectName, key, value] of [["common", "dimOpacity", background.dimOpacity], ["navbar", "transparentMode", background.transparentMode], ["navbar", "blur", background.blur]]) {
		if (value !== undefined) nextWallpaper = replaceObjectField(nextWallpaper, objectName, key, value);
	}

	await Promise.all([
		writeText(SITE_CONFIG, nextSite),
		writeText(PROFILE_CONFIG, nextProfile),
		writeText(WALLPAPER_CONFIG, nextWallpaper),
	]);
	if (data.features) await saveFeatures(data.features);
}

function safePostPath(input, allowMissing = false) {
	if (typeof input !== "string" || !input.trim()) throw new Error("文章路径不能为空");
	const normalized = path.posix.normalize(input.replaceAll("\\", "/"));
	if (normalized.startsWith("../") || normalized.includes("/../") || normalized.startsWith("/")) {
		throw new Error("文章路径不合法");
	}
	if (!/\.(md|mdx)$/i.test(normalized)) throw new Error("只支持 Markdown 或 MDX 文章");
	const target = path.resolve(POSTS_DIR, normalized);
	const root = `${path.resolve(POSTS_DIR)}${path.sep}`;
	if (!target.startsWith(root)) throw new Error("文章路径不合法");
	if (!allowMissing) return target;
	return target;
}

async function walkPosts(directory, relative = "") {
	const entries = await fs.readdir(directory, { withFileTypes: true });
	const result = [];
	for (const entry of entries) {
		const absolute = path.join(directory, entry.name);
		const rel = path.posix.join(relative, entry.name);
		if (entry.isDirectory()) {
			result.push(...(await walkPosts(absolute, rel)));
		} else if (/\.(md|mdx)$/i.test(entry.name)) {
			result.push(rel);
		}
	}
	return result;
}

function dateValue(value) {
	if (!value) return "";
	if (value instanceof Date) return value.toISOString().slice(0, 10);
	return String(value).slice(0, 10);
}

async function readPost(relativePath) {
	const target = safePostPath(relativePath);
	const source = await readText(target);
	const parsed = matter(source);
	return {
		path: relativePath,
		title: String(parsed.data.title || ""),
		description: String(parsed.data.description || ""),
		published: dateValue(parsed.data.published),
		image: String(parsed.data.image || ""),
		tags: Array.isArray(parsed.data.tags) ? parsed.data.tags.map(String) : [],
		category: String(parsed.data.category || ""),
		draft: Boolean(parsed.data.draft),
		comment: parsed.data.comment !== false,
		lang: String(parsed.data.lang || "zh_CN"),
		pinned: Boolean(parsed.data.pinned),
		body: parsed.content.trimStart(),
	};
}

async function listPosts() {
	const paths = await walkPosts(POSTS_DIR);
	const posts = await Promise.all(paths.map(readPost));
	return posts.sort((a, b) => (b.published || "").localeCompare(a.published || ""));
}

function quote(value) {
	return JSON.stringify(String(value ?? ""));
}

function normalizeTags(tags) {
	if (Array.isArray(tags)) return tags.map((item) => String(item).trim()).filter(Boolean);
	return String(tags || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function normalizePublished(value) {
	const date = String(value || new Date().toISOString().slice(0, 10));
	return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10);
}

function serializePost(data) {
	const tags = normalizeTags(data.tags);
	const body = String(data.body || "").trimStart();
	return [
		"---",
		`title: ${quote(data.title)}`,
		`published: ${normalizePublished(data.published)}`,
		`description: ${quote(data.description)}`,
		`image: ${quote(data.image)}`,
		`tags: ${JSON.stringify(tags)}`,
		`category: ${quote(data.category)}`,
		`draft: ${Boolean(data.draft)}`,
		`lang: ${quote(data.lang || "zh_CN")}`,
		`pinned: ${Boolean(data.pinned)}`,
		`comment: ${data.comment !== false}`,
		"---",
		"",
		body,
		"",
	].join("\n");
}

function validateSlug(slug) {
	if (typeof slug !== "string" || !slug.trim()) throw new Error("文章路径不能为空");
	const normalized = slug.trim().replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
	const extension = /\.(md|mdx)$/i.exec(normalized)?.[0] || "";
	const pathWithoutExtension = extension ? normalized.slice(0, -extension.length) : normalized;
	if (!/^[a-zA-Z0-9_\-/]+$/.test(pathWithoutExtension)) throw new Error("文章路径只能使用英文、数字、下划线、短横线和目录分隔符");
	return extension ? `${pathWithoutExtension}${extension.toLowerCase()}` : `${pathWithoutExtension}.md`;
}

async function savePost(data) {
	const relativePath = data.path ? validateSlug(data.path) : validateSlug(data.slug || data.title);
	const target = safePostPath(relativePath, true);
	await fs.mkdir(path.dirname(target), { recursive: true });
	await writeText(target, serializePost(data));
	return readPost(relativePath);
}

function parseBody(req) {
	return new Promise((resolve, reject) => {
		let body = "";
		req.on("data", (chunk) => {
			body += chunk;
			if (body.length > 16 * 1024 * 1024) {
				req.destroy();
				reject(new Error("请求内容过大"));
			}
		});
		req.on("end", () => {
			try {
				resolve(body ? JSON.parse(body) : {});
			} catch {
				reject(new Error("请求数据格式错误"));
			}
		});
		req.on("error", reject);
	});
}

function run(command, args) {
	if (runningTask) return Promise.reject(new Error("已有命令正在执行，请稍后再试"));
	runningTask = new Promise((resolve) => {
		const child = spawn(command, args, { cwd: ROOT, shell: false, windowsHide: true });
		let output = "";
		const append = (chunk) => {
			output += chunk.toString();
			if (output.length > 20000) output = output.slice(-20000);
		};
		child.stdout.on("data", append);
		child.stderr.on("data", append);
		child.on("error", (error) => resolve({ code: 1, output: error.message }));
		child.on("close", (code) => resolve({ code: code ?? 1, output }));
	}).finally(() => {
		runningTask = null;
	});
	return runningTask;
}

function runRuntime(mode, input = "") {
	return new Promise((resolve) => {
		const child = spawn(COMMAND, ["exec", "tsx", CONFIG_RUNTIME, mode], {
			cwd: ROOT,
			shell: process.platform === "win32",
			windowsHide: true,
			stdio: ["pipe", "pipe", "pipe"],
		});
		let output = "";
		let errorOutput = "";
		child.stdout.on("data", (chunk) => { output += chunk.toString(); });
		child.stderr.on("data", (chunk) => { errorOutput += chunk.toString(); });
		child.on("error", (error) => resolve({ code: 1, output: error.message }));
		child.on("close", (code) => resolve({ code: code ?? 1, output: output || errorOutput }));
		if (input) child.stdin.write(input);
		child.stdin.end();
	});
}

async function readFullConfigs() {
	const result = await runRuntime("read");
	if (result.code !== 0) throw new Error(result.output || "读取完整配置失败");
	const parsed = JSON.parse(result.output);
	return parsed.configs || {};
}

async function saveFullConfigs(configs) {
	const result = await runRuntime("write", JSON.stringify(configs || {}));
	if (result.code !== 0) throw new Error(result.output || "保存完整配置失败");
}

function normalizeMediaAlbum(data) {
	const id = safeAlbumId(data?.id);
	const album = {
		id,
		name: String(data?.name || id).trim() || id,
		description: String(data?.description || "").trim(),
		location: String(data?.location || "").trim(),
		date: String(data?.date || "").trim(),
		tags: normalizeTags(data?.tags),
	};
	for (const key of ["password", "passwordHint"]) {
		const value = String(data?.[key] || "").trim();
		if (value) album[key] = value;
	}
	if (data?.cover) album.cover = String(data.cover).trim();
	return album;
}

async function saveGalleryAlbums(albums) {
	const configs = await readFullConfigs();
	const current = configs.gallery || {};
	await saveFullConfigs({ gallery: { ...current, albums } });
}

async function readMedia() {
	const [config, configs] = await Promise.all([readConfig(), readFullConfigs()]);
	const profilePath = config.profile.avatar || "";
	const avatarFile = localAvatarPath(profilePath);
	const avatar = {
		path: profilePath,
		url: avatarFile && await fs.stat(avatarFile).catch(() => null) ? "/media/avatar" : (/^(https?:)?\/\//i.test(profilePath) ? profilePath : ""),
		local: Boolean(avatarFile),
	};
	const gallery = configs.gallery || {};
	const albums = await Promise.all((Array.isArray(gallery.albums) ? gallery.albums : []).map(async (rawAlbum) => {
		const album = normalizeMediaAlbum(rawAlbum);
		const directory = mediaPathInside(GALLERY_DIR, album.id);
		const files = await existingMediaFiles(directory);
		const urlsFile = path.join(directory, "urls.txt");
		const remoteUrls = await fs.readFile(urlsFile, "utf8").catch(() => "");
		return {
			...album,
			photos: files.map((filename) => ({ filename, url: `/media/gallery/${encodeURIComponent(album.id)}/${encodeURIComponent(filename)}`, local: true })),
			remoteUrls: remoteUrls.split(/\r?\n/).map((item) => item.trim()).filter((item) => item && !item.startsWith("#")),
		};
	}));
	return { avatar, albums, columnWidth: gallery.columnWidth || 240 };
}

async function saveUploadedAvatar(data) {
	const { buffer, extension } = parseImageData(data?.dataUrl);
	const filename = `avatar.${extension}`;
	await fs.mkdir(SRC_IMAGES_DIR, { recursive: true });
	await fs.writeFile(mediaPathInside(SRC_IMAGES_DIR, filename), buffer);
	const profileText = await readText(PROFILE_CONFIG);
	const currentPath = readScalar(profileText, "avatar");
	const oldPath = localAvatarPath(currentPath);
	let nextProfile = replaceScalar(profileText, "avatar", `assets/images/${filename}`);
	await writeText(PROFILE_CONFIG, nextProfile);
	if (oldPath && oldPath !== mediaPathInside(SRC_IMAGES_DIR, filename) && /^avatar\.[a-z0-9]+$/i.test(path.basename(oldPath))) {
		await fs.unlink(oldPath).catch(() => {});
	}
	return { path: `assets/images/${filename}`, url: "/media/avatar" };
}

async function saveAlbum(data) {
	const configs = await readFullConfigs();
	const gallery = configs.gallery || {};
	const inputAlbum = data?.album || {};
	const album = normalizeMediaAlbum(inputAlbum);
	const albums = Array.isArray(gallery.albums) ? gallery.albums.map((item) => normalizeMediaAlbum(item)) : [];
	const existingIndex = albums.findIndex((item) => item.id === album.id);
	if (existingIndex >= 0) {
		if (!Object.prototype.hasOwnProperty.call(inputAlbum, "cover") && albums[existingIndex].cover) album.cover = albums[existingIndex].cover;
		albums[existingIndex] = album;
	}
	else albums.push(album);
	await fs.mkdir(mediaPathInside(GALLERY_DIR, album.id), { recursive: true });
	await saveGalleryAlbums(albums);
	return album;
}

async function deleteAlbum(albumId) {
	const id = safeAlbumId(albumId);
	const configs = await readFullConfigs();
	const gallery = configs.gallery || {};
	const albums = (Array.isArray(gallery.albums) ? gallery.albums : []).filter((item) => String(item.id) !== id);
	await fs.rm(mediaPathInside(GALLERY_DIR, id), { recursive: true, force: true });
	await saveGalleryAlbums(albums.map(normalizeMediaAlbum));
}

async function saveAlbumUrls(data) {
	const id = safeAlbumId(data?.albumId);
	const urls = String(data?.urls || "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
	if (urls.some((item) => !/^https?:\/\//i.test(item))) throw new Error("远程图片地址必须以 http:// 或 https:// 开头");
	if (urls.length > 100) throw new Error("远程图片最多保存 100 个地址");
	const directory = mediaPathInside(GALLERY_DIR, id);
	await fs.mkdir(directory, { recursive: true });
	await writeText(path.join(directory, "urls.txt"), urls.length ? `${urls.join("\n")}\n` : "");
}

async function saveAlbumPhoto(data) {
	const albumId = safeAlbumId(data?.albumId);
	const { buffer, extension } = parseImageData(data?.dataUrl);
	const directory = mediaPathInside(GALLERY_DIR, albumId);
	await fs.mkdir(directory, { recursive: true });
	const requestedName = safeMediaFilename(data?.filename, extension);
	const base = path.basename(requestedName, path.extname(requestedName));
	const suffix = path.extname(requestedName);
	let filename = requestedName;
	let sequence = 2;
	while (await fs.stat(mediaPathInside(directory, filename)).catch(() => null)) filename = `${base}-${sequence++}${suffix}`;
	await fs.writeFile(mediaPathInside(directory, filename), buffer);
	return { filename, url: `/media/gallery/${encodeURIComponent(albumId)}/${encodeURIComponent(filename)}` };
}

function safeAssetFolder(value) {
	const folder = String(value || "managed").trim().replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
	if (!/^managed(?:\/[a-zA-Z0-9_-]+){0,2}$/.test(folder)) throw new Error("图片分类目录不合法");
	return folder;
}

async function saveMediaAsset(data) {
	const { buffer, extension } = parseImageData(data?.dataUrl);
	const folder = safeAssetFolder(data?.folder);
	const directory = mediaPathInside(PUBLIC_IMAGES_DIR, folder);
	await fs.mkdir(directory, { recursive: true });
	const requestedName = safeMediaFilename(data?.filename, extension);
	const base = path.basename(requestedName, path.extname(requestedName));
	const suffix = path.extname(requestedName);
	let filename = requestedName;
	let sequence = 2;
	while (await fs.stat(mediaPathInside(directory, filename)).catch(() => null)) filename = `${base}-${sequence++}${suffix}`;
	await fs.writeFile(mediaPathInside(directory, filename), buffer);
	const relative = `${folder}/${filename}`;
	return { filename, path: `/assets/images/${relative}`, url: mediaLibraryUrl("public", relative) };
}

async function deleteMediaAsset(data) {
	const value = String(data?.path || "").replace(/^\/+/, "").replaceAll("\\", "/");
	if (!/^assets\/images\/managed\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\.(?:jpe?g|png|webp|avif|gif|svg)$/i.test(value) && !/^assets\/images\/managed\/[a-zA-Z0-9_-]+\.(?:jpe?g|png|webp|avif|gif|svg)$/i.test(value)) {
		throw new Error("只能删除媒体库中上传的图片");
	}
	const relative = value.slice("assets/images/".length);
	await fs.unlink(mediaPathInside(PUBLIC_IMAGES_DIR, relative));
}

async function deleteAlbumPhoto(albumId, filename) {
	const id = safeAlbumId(albumId);
	const safeName = safeMediaFilename(filename);
	if (safeName !== filename) throw new Error("图片文件名不合法");
	await fs.unlink(mediaPathInside(mediaPathInside(GALLERY_DIR, id), safeName));
}

async function setAlbumCover(data) {
	const id = safeAlbumId(data?.albumId);
	const filename = data?.filename ? safeMediaFilename(data.filename) : "";
	if (filename && !(await fs.stat(mediaPathInside(mediaPathInside(GALLERY_DIR, id), filename)).catch(() => null))) throw new Error("封面图片不存在");
	const configs = await readFullConfigs();
	const gallery = configs.gallery || {};
	const albums = (Array.isArray(gallery.albums) ? gallery.albums : []).map((item) => {
		const album = normalizeMediaAlbum(item);
		if (album.id !== id) return album;
		if (filename) album.cover = `/gallery/${id}/${filename}`;
		else delete album.cover;
		return album;
	});
	await saveGalleryAlbums(albums);
}

async function serveMedia(res, url) {
	if (url.pathname === "/media/library") {
		const rootKey = url.searchParams.get("root");
		const relative = String(url.searchParams.get("path") || "").replaceAll("\\", "/");
		const root = rootKey === "src-images" ? SRC_IMAGES_DIR : rootKey === "content" ? CONTENT_DIR : rootKey === "public" ? path.join(ROOT, "public") : null;
		if (!root || !relative || relative.includes("..")) return sendJson(res, 404, { ok: false, error: "媒体文件不存在" });
		const target = mediaPathInside(root, relative);
		const content = await fs.readFile(target).catch(() => null);
		if (!content) return sendJson(res, 404, { ok: false, error: "媒体文件不存在" });
		const extension = path.extname(target).slice(1).toLowerCase();
		res.writeHead(200, { "Content-Type": IMAGE_MIME_TYPES[extension] || "application/octet-stream", "Cache-Control": "no-store" });
		return res.end(content);
	}
	const parts = url.pathname.split("/").slice(2).filter(Boolean).map((item) => decodeURIComponent(item));
	let target;
	if (parts.length === 1 && parts[0] === "avatar") {
		const config = await readConfig();
		target = localAvatarPath(config.profile.avatar);
	} else if (parts.length === 3 && parts[0] === "gallery") {
		const albumId = safeAlbumId(parts[1]);
		const filename = safeMediaFilename(parts[2]);
		if (filename !== parts[2]) return sendJson(res, 404, { ok: false, error: "媒体文件不存在" });
		target = mediaPathInside(mediaPathInside(GALLERY_DIR, albumId), filename);
	}
	if (!target) return sendJson(res, 404, { ok: false, error: "媒体文件不存在" });
	const content = await fs.readFile(target).catch(() => null);
	if (!content) return sendJson(res, 404, { ok: false, error: "媒体文件不存在" });
	const extension = path.extname(target).slice(1).toLowerCase();
	res.writeHead(200, { "Content-Type": IMAGE_MIME_TYPES[extension] || "application/octet-stream", "Cache-Control": "no-store" });
	res.end(content);
}

async function handleApi(req, res, url) {
	if (req.method === "GET" && url.pathname === "/api/media") {
		const media = await readMedia();
		media.library = await readMediaLibrary();
		return sendJson(res, 200, { ok: true, media });
	}

	if (req.method === "POST" && url.pathname === "/api/media/asset") {
		return sendJson(res, 200, { ok: true, asset: await saveMediaAsset(await parseBody(req)), message: "图片已上传" });
	}

	if (req.method === "DELETE" && url.pathname === "/api/media/asset") {
		await deleteMediaAsset(await parseBody(req));
		return sendJson(res, 200, { ok: true, message: "图片已删除" });
	}

	if (req.method === "POST" && url.pathname === "/api/media/avatar") {
		return sendJson(res, 200, { ok: true, avatar: await saveUploadedAvatar(await parseBody(req)), message: "头像已保存" });
	}

	if (req.method === "POST" && url.pathname === "/api/media/albums") {
		return sendJson(res, 200, { ok: true, album: await saveAlbum(await parseBody(req)), message: "相册信息已保存" });
	}

	if (req.method === "DELETE" && url.pathname.startsWith("/api/media/albums/")) {
		await deleteAlbum(decodeURIComponent(url.pathname.slice("/api/media/albums/".length)));
		return sendJson(res, 200, { ok: true, message: "相册已删除" });
	}

	if (req.method === "POST" && url.pathname === "/api/media/photos") {
		return sendJson(res, 200, { ok: true, photo: await saveAlbumPhoto(await parseBody(req)), message: "照片已上传" });
	}

	if (req.method === "DELETE" && url.pathname.startsWith("/api/media/photos/")) {
		const parts = url.pathname.slice("/api/media/photos/".length).split("/").map((item) => decodeURIComponent(item));
		if (parts.length !== 2) throw new Error("图片地址不合法");
		await deleteAlbumPhoto(parts[0], parts[1]);
		return sendJson(res, 200, { ok: true, message: "照片已删除" });
	}

	if (req.method === "POST" && url.pathname === "/api/media/urls") {
		await saveAlbumUrls(await parseBody(req));
		return sendJson(res, 200, { ok: true, message: "远程图片地址已保存" });
	}

	if (req.method === "POST" && url.pathname === "/api/media/cover") {
		await setAlbumCover(await parseBody(req));
		return sendJson(res, 200, { ok: true, message: "相册封面已更新" });
	}

	if (req.method === "GET" && url.pathname === "/api/state") {
		const [config, fullConfigs, posts, pages] = await Promise.all([readConfig(), readFullConfigs(), listPosts(), readPages()]);
		return sendJson(res, 200, { ok: true, config, fullConfigs, posts, pages });
	}

	if (req.method === "POST" && url.pathname === "/api/config") {
		await saveConfig(await parseBody(req));
		return sendJson(res, 200, { ok: true, message: "配置已保存" });
	}

	if (req.method === "POST" && url.pathname === "/api/pages") {
		await savePages(await parseBody(req));
		return sendJson(res, 200, { ok: true, message: "页面内容已保存" });
	}

	if (req.method === "POST" && url.pathname === "/api/full-config") {
		const data = await parseBody(req);
		await saveFullConfigs(data.configs);
		return sendJson(res, 200, { ok: true, message: "完整配置已保存" });
	}

	if (req.method === "POST" && url.pathname === "/api/posts") {
		const post = await savePost(await parseBody(req));
		return sendJson(res, 200, { ok: true, post, message: "文章已保存" });
	}

	if (req.method === "DELETE" && url.pathname.startsWith("/api/posts/")) {
		const relativePath = decodeURIComponent(url.pathname.slice("/api/posts/".length));
		await fs.unlink(safePostPath(relativePath));
		return sendJson(res, 200, { ok: true, message: "文章已删除" });
	}

	if (req.method === "POST" && url.pathname === "/api/build") {
		const result = await run(COMMAND, ["run", "build"]);
		return sendJson(res, result.code === 0 ? 200 : 500, { ok: result.code === 0, ...result });
	}

	if (req.method === "POST" && url.pathname === "/api/publish") {
		const data = await parseBody(req);
		const message = String(data.message || "更新博客内容").trim().slice(0, 100);
		const add = await run("git", ["add", "src/config", "src/content", "src/assets/images", "public/assets", "public/favicon", "public/gallery", "admin", "scripts/admin-server.mjs", "scripts/admin-config-runtime.ts", "package.json"]);
		if (add.code !== 0) return sendJson(res, 500, { ok: false, ...add });
		const commit = await run("git", ["commit", "-m", message]);
		if (commit.code !== 0 && !commit.output.includes("nothing to commit")) return sendJson(res, 500, { ok: false, ...commit });
		const push = await run("git", ["push"]);
		return sendJson(res, push.code === 0 ? 200 : 500, { ok: push.code === 0, output: [commit.output, push.output].filter(Boolean).join("\n") });
	}

	return sendJson(res, 404, { ok: false, error: "接口不存在" });
}

const STATIC_MIME_TYPES = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".mjs": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".svg": "image/svg+xml",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".webp": "image/webp",
	".avif": "image/avif",
	".ico": "image/x-icon",
	".woff": "font/woff",
	".woff2": "font/woff2",
	".ttf": "font/ttf",
	".map": "application/json; charset=utf-8",
	".txt": "text/plain; charset=utf-8",
};

async function pathExists(target) {
	try {
		await fs.access(target);
		return true;
	} catch {
		return false;
	}
}

async function serveStaticFile(res, filePath, cacheControl = "no-store") {
	const content = await fs.readFile(filePath);
	const extension = path.extname(filePath).toLowerCase();
	res.writeHead(200, {
		"Content-Type": STATIC_MIME_TYPES[extension] || "application/octet-stream",
		"Cache-Control": cacheControl,
	});
	res.end(content);
}

async function serveAdminSpa(res, pathname) {
	const distReady = await pathExists(path.join(ADMIN_DIST, "index.html"));
	if (distReady) {
		const decodedPath = decodeURIComponent(pathname.split("?")[0] || "/");
		const relativePath = decodedPath === "/" ? "index.html" : decodedPath.replace(/^\/+/, "");
		const candidate = path.resolve(ADMIN_DIST, relativePath);
		const rel = path.relative(ADMIN_DIST, candidate);
		if (!rel.startsWith("..") && !path.isAbsolute(rel) && (await pathExists(candidate))) {
			const stat = await fs.stat(candidate);
			if (stat.isFile()) {
				const cacheControl = path.extname(candidate) && path.extname(candidate) !== ".html" ? "public, max-age=31536000, immutable" : "no-store";
				return serveStaticFile(res, candidate, cacheControl);
			}
		}
		return serveStaticFile(res, path.join(ADMIN_DIST, "index.html"), "no-store");
	}

	if (await pathExists(ADMIN_LEGACY_PAGE)) {
		return serveStaticFile(res, ADMIN_LEGACY_PAGE, "no-store");
	}

	if (await pathExists(ADMIN_PAGE)) {
		const html = await readText(ADMIN_PAGE);
		// Vite source entry is not runnable without build; show guidance instead.
		if (html.includes("/src/main.ts")) {
			res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
			return res.end(`<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>Firefly Admin</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f3f4f6;color:#1f2937;font:14px/1.6 system-ui,sans-serif}main{max-width:36rem;padding:2rem;border:1px solid #e5e7eb;border-radius:4px;background:#fff;box-shadow:0 1px 2px rgb(0 0 0/.05)}code{background:#f3f4f6;padding:.1rem .35rem;border-radius:3px}</style></head><body><main><h1 style="margin:0 0 .75rem;font-size:1.25rem">管理后台尚未构建</h1><p style="margin:0 0 .75rem;color:#6b7280">请先执行 <code>pnpm admin:build</code>，或开发时同时运行 <code>pnpm admin</code> 与 <code>pnpm admin:dev</code>。</p><p style="margin:0;color:#6b7280">开发地址：<code>http://127.0.0.1:5174</code></p></main></body></html>`);
		}
		return serveStaticFile(res, ADMIN_PAGE, "no-store");
	}

	return sendJson(res, 404, { ok: false, error: "管理后台页面不存在，请先执行 pnpm admin:build" });
}

const server = http.createServer(async (req, res) => {
	try {
		const url = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);
		if (req.method === "GET" && url.pathname.startsWith("/media/")) return await serveMedia(res, url);
		if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url);
		if (req.method === "GET") return await serveAdminSpa(res, url.pathname);
		return sendJson(res, 404, { ok: false, error: "页面不存在" });
	} catch (error) {
		console.error(error);
		if (!res.headersSent) sendError(res, error);
	}
});

server.listen(PORT, "127.0.0.1", () => {
	console.log(`Firefly 本地管理后台：http://127.0.0.1:${PORT}`);
	console.log(`开发模式可另开终端运行：pnpm admin:dev  (http://127.0.0.1:5174)`);
});
