import { promises as fs } from "node:fs";
import path from "node:path";
import ts from "typescript";

import { analyticsConfig } from "../src/config/analyticsConfig";
import { announcementConfig } from "../src/config/announcementConfig";
import { backgroundWallpaper } from "../src/config/backgroundWallpaper";
import { booknavConfig, booknavPageConfig } from "../src/config/booknavConfig";
import { commentConfig } from "../src/config/commentConfig";
import { coverImageConfig } from "../src/config/coverImageConfig";
import { displaySettingsConfig } from "../src/config/displaySettingsConfig";
import { dynamicConfig } from "../src/config/dynamicConfig";
import { sakuraConfig } from "../src/config/effectsConfig";
import { expressiveCodeConfig } from "../src/config/expressiveCodeConfig";
import { fontConfig, fontsList } from "../src/config/fontConfig";
import { footerConfig } from "../src/config/footerConfig";
import { friendsConfig, friendsPageConfig } from "../src/config/friendsConfig";
import { galleryConfig } from "../src/config/galleryConfig";
import { licenseConfig } from "../src/config/licenseConfig";
import { mermaidConfig } from "../src/config/mermaidConfig";
import { musicPlayerConfig } from "../src/config/musicConfig";
import { navBarConfig, navBarSearchConfig } from "../src/config/navBarConfig";
import { live2dWidgetConfig, spineModelConfig } from "../src/config/pioConfig";
import { plantumlConfig } from "../src/config/plantumlConfig";
import { profileConfig } from "../src/config/profileConfig";
import { sidebarLayoutConfig } from "../src/config/sidebarConfig";
import { siteConfig } from "../src/config/siteConfig";
import { sponsorConfig } from "../src/config/sponsorConfig";

const root = process.cwd();

const configFiles: Record<string, { file: string; exportName: string }> = {
	analytics: { file: "src/config/analyticsConfig.ts", exportName: "analyticsConfig" },
	announcement: { file: "src/config/announcementConfig.ts", exportName: "announcementConfig" },
	background: { file: "src/config/backgroundWallpaper.ts", exportName: "backgroundWallpaper" },
	booknavPage: { file: "src/config/booknavConfig.ts", exportName: "booknavPageConfig" },
	booknav: { file: "src/config/booknavConfig.ts", exportName: "booknavConfig" },
	comment: { file: "src/config/commentConfig.ts", exportName: "commentConfig" },
	coverImage: { file: "src/config/coverImageConfig.ts", exportName: "coverImageConfig" },
	displaySettings: { file: "src/config/displaySettingsConfig.ts", exportName: "displaySettingsConfig" },
	dynamic: { file: "src/config/dynamicConfig.ts", exportName: "dynamicConfig" },
	effects: { file: "src/config/effectsConfig.ts", exportName: "sakuraConfig" },
	expressiveCode: { file: "src/config/expressiveCodeConfig.ts", exportName: "expressiveCodeConfig" },
	fontsList: { file: "src/config/fontConfig.ts", exportName: "fontsList" },
	font: { file: "src/config/fontConfig.ts", exportName: "fontConfig" },
	footer: { file: "src/config/footerConfig.ts", exportName: "footerConfig" },
	friendsPage: { file: "src/config/friendsConfig.ts", exportName: "friendsPageConfig" },
	friends: { file: "src/config/friendsConfig.ts", exportName: "friendsConfig" },
	gallery: { file: "src/config/galleryConfig.ts", exportName: "galleryConfig" },
	license: { file: "src/config/licenseConfig.ts", exportName: "licenseConfig" },
	mermaid: { file: "src/config/mermaidConfig.ts", exportName: "mermaidConfig" },
	music: { file: "src/config/musicConfig.ts", exportName: "musicPlayerConfig" },
	navbar: { file: "src/config/navBarConfig.ts", exportName: "navBarConfig" },
	navbarSearch: { file: "src/config/navBarConfig.ts", exportName: "navBarSearchConfig" },
	pioSpine: { file: "src/config/pioConfig.ts", exportName: "spineModelConfig" },
	pioLive2d: { file: "src/config/pioConfig.ts", exportName: "live2dWidgetConfig" },
	plantuml: { file: "src/config/plantumlConfig.ts", exportName: "plantumlConfig" },
	profile: { file: "src/config/profileConfig.ts", exportName: "profileConfig" },
	sidebar: { file: "src/config/sidebarConfig.ts", exportName: "sidebarLayoutConfig" },
	site: { file: "src/config/siteConfig.ts", exportName: "siteConfig" },
	sponsor: { file: "src/config/sponsorConfig.ts", exportName: "sponsorConfig" },
};

const values: Record<string, unknown> = {
	analytics: analyticsConfig,
	announcement: announcementConfig,
	background: backgroundWallpaper,
	booknavPage: booknavPageConfig,
	booknav: booknavConfig,
	comment: commentConfig,
	coverImage: coverImageConfig,
	displaySettings: displaySettingsConfig,
	dynamic: dynamicConfig,
	effects: sakuraConfig,
	expressiveCode: expressiveCodeConfig,
	fontsList,
	font: fontConfig,
	footer: footerConfig,
	friendsPage: friendsPageConfig,
	friends: friendsConfig,
	gallery: galleryConfig,
	license: licenseConfig,
	mermaid: mermaidConfig,
	music: musicPlayerConfig,
	navbar: navBarConfig,
	navbarSearch: navBarSearchConfig,
	pioSpine: spineModelConfig,
	pioLive2d: live2dWidgetConfig,
	plantuml: plantumlConfig,
	profile: profileConfig,
	sidebar: sidebarLayoutConfig,
	site: siteConfig,
	sponsor: sponsorConfig,
};

function findVariable(sourceFile: ts.SourceFile, name: string): ts.VariableDeclaration | undefined {
	let found: ts.VariableDeclaration | undefined;
	ts.forEachChild(sourceFile, function visit(node) {
		if (found) return;
		if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) {
			found = node;
			return;
		}
		ts.forEachChild(node, visit);
	});
	return found;
}

function writeInitializer(source: string, exportName: string, value: unknown): string {
	const sourceFile = ts.createSourceFile("config.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
	const declaration = findVariable(sourceFile, exportName);
	if (!declaration?.initializer) throw new Error(`找不到配置导出：${exportName}`);
	const start = declaration.initializer.getStart(sourceFile);
	const end = declaration.initializer.getEnd();
	const serialized = JSON.stringify(value, null, "\t");
	return `${source.slice(0, start)}${serialized}${source.slice(end)}`;
}

async function writeConfigs(input: Record<string, unknown>) {
	const grouped = new Map<string, Array<{ exportName: string; value: unknown }>>();
	for (const [key, value] of Object.entries(input || {})) {
		const definition = configFiles[key];
		if (!definition) throw new Error(`不支持的配置项：${key}`);
		if (value === null || typeof value !== "object") throw new Error(`配置项必须是对象或数组：${key}`);
		const list = grouped.get(definition.file) || [];
		list.push({ exportName: definition.exportName, value });
		grouped.set(definition.file, list);
	}

	for (const [relativeFile, entries] of grouped) {
		const file = path.resolve(root, relativeFile);
		let source = await fs.readFile(file, "utf8");
		for (const entry of entries) source = writeInitializer(source, entry.exportName, entry.value);
		await fs.writeFile(file, source, "utf8");
	}
}

async function main() {
	if (process.argv[2] === "write") {
		let input = "";
		process.stdin.setEncoding("utf8");
		for await (const chunk of process.stdin) input += chunk;
		await writeConfigs(JSON.parse(input || "{}"));
		process.stdout.write(JSON.stringify({ ok: true }));
		return;
	}
	process.stdout.write(JSON.stringify({ ok: true, configs: values }));
}

main().catch((error) => {
	console.error(error instanceof Error ? error.stack || error.message : String(error));
	process.exitCode = 1;
});
