import {
	type NavBarConfig,
	type NavBarLink,
	type NavBarSearchConfig,
	NavBarSearchMethod,
} from "../types/navBarConfig";

// ============================================================================
// 导航栏配置 - 根据顺序动态生成导航栏链接
// NavBar Configuration - Dynamically generate navigation bar links based on order
// ============================================================================
const getDynamicNavBarConfig = (): NavBarConfig => {
	// 基础导航栏链接
	const links: NavBarLink[] = [];

	// 主页
	links.push(LinkPresets.Home);

	// 文章及其子菜单
	links.push({
		name: "文章",
		url: "#",
		icon: "material-symbols:article",
		children: [
			// 归档
			LinkPresets.Archive,

			// 分类
			LinkPresets.Categories,

			// 标签
			LinkPresets.Tags,
		],
	});

	//社交及其子菜单
	links.push({
		name: "社交",
		url: "#",
		icon: "material-symbols:group",
		children: [
			// 友链
			LinkPresets.Friends,

			// 留言
			LinkPresets.Guestbook,
		],
	});

	// 我的及其子菜单
	links.push({
		name: "我的",
		url: "#",
		icon: "material-symbols:person",
		children: [
			// 动态
			LinkPresets.Dynamic,

			// 相册
			LinkPresets.Gallery,

			// 追番
			LinkPresets.Anime,

			// 番组计划
			LinkPresets.Bangumi,

			// 书签导航
			LinkPresets.Booknav,
		],
	});

	// 关于及其子菜单
	links.push({
		name: "关于",
		url: "#",
		icon: "material-symbols:info",
		children: [
			// 打赏
			LinkPresets.Sponsor,

			// 关于页面
			LinkPresets.About,
		],
	});

	// 自定义导航栏链接
	links.push({
		name: "链接",
		url: "#",
		icon: "material-symbols:link",
		// 子菜单
		children: [
			{
				name: "GitHub",
				url: "https://github.com/CuteLeaf/Firefly",
				external: true,
				icon: "fa7-brands:github",
			},
			{
				name: "Gitee",
				url: "https://gitee.com/CuteLeaf/Firefly",
				external: true,
				icon: "fa7-brands:gitee",
			},
			{
				name: "QQ交流群",
				url: "https://qm.qq.com/q/ZGsFa8qX2G",
				external: true,
				icon: "fa7-brands:qq",
			},
			{
				name: "Firefly文档",
				url: "https://docs-firefly.cuteleaf.cn",
				external: true,
				icon: "material-symbols:docs",
			},
		],
	});

	// 文档链接
	// links.push({
	// 	name: "文档",
	// 	url: "https://docs-firefly.cuteleaf.cn",
	// 	external: true,
	// 	icon: "material-symbols:docs",
	// });

	return { links } as NavBarConfig;
};

// 导航搜索配置
export const navBarSearchConfig: NavBarSearchConfig = {
	"method": 0
};

// ============================================================================
// 链接预设 - 可自由自定义导航栏链接的名称、图标和URL
// Link Presets - Allows free customization of the name, icon, and URL of navigation bar links
// ============================================================================
export const LinkPresets: Record<string, NavBarLink> = {
	Home: {
		name: "主页",
		url: "/",
		icon: "material-symbols:home",
	},
	Dynamic: {
		name: "动态",
		url: "/dynamic/",
		icon: "material-symbols:forum-rounded",
		pageKey: "dynamic",
	},
	Archive: {
		name: "归档",
		url: "/archive/",
		icon: "material-symbols:archive",
	},
	Categories: {
		name: "分类",
		url: "/categories/",
		icon: "material-symbols:folder-open-rounded",
	},
	Tags: {
		name: "标签",
		url: "/tags/",
		icon: "material-symbols:tag-rounded",
	},
	Friends: {
		name: "友链",
		url: "/friends/",
		icon: "material-symbols:link-2-rounded",
		pageKey: "friends",
	},
	Sponsor: {
		name: "打赏",
		url: "/sponsor/",
		icon: "material-symbols:favorite",
		pageKey: "sponsor",
	},
	Guestbook: {
		name: "留言",
		url: "/guestbook/",
		icon: "material-symbols:chat",
		pageKey: "guestbook",
	},
	About: {
		name: "关于我",
		url: "/about/",
		icon: "material-symbols:person",
	},
	Bangumi: {
		name: "番组计划",
		url: "/bangumi/",
		icon: "material-symbols:movie",
		pageKey: "bangumi",
	},
	Gallery: {
		name: "相册",
		url: "/gallery/",
		icon: "material-symbols:photo-library",
		pageKey: "gallery",
	},
	Anime: {
		name: "追番",
		url: "/anime/",
		icon: "material-symbols:live-tv",
		pageKey: "anime",
	},
	Booknav: {
		name: "书签导航",
		url: "/booknav/",
		icon: "material-symbols:bookmarks",
		pageKey: "booknav",
	},
};

export const navBarConfig: NavBarConfig = {
	"links": [
		{
			"name": "主页",
			"url": "/",
			"icon": "material-symbols:home"
		},
		{
			"name": "文章",
			"url": "#",
			"icon": "material-symbols:article",
			"children": [
				{
					"name": "归档",
					"url": "/archive/",
					"icon": "material-symbols:archive"
				},
				{
					"name": "分类",
					"url": "/categories/",
					"icon": "material-symbols:folder-open-rounded"
				},
				{
					"name": "标签",
					"url": "/tags/",
					"icon": "material-symbols:tag-rounded"
				}
			]
		},
		{
			"name": "社交",
			"url": "#",
			"icon": "material-symbols:group",
			"children": [
				{
					"name": "友链",
					"url": "/friends/",
					"icon": "material-symbols:link-2-rounded",
					"pageKey": "friends"
				},
				{
					"name": "留言",
					"url": "/guestbook/",
					"icon": "material-symbols:chat",
					"pageKey": "guestbook"
				}
			]
		},
		{
			"name": "我的",
			"url": "#",
			"icon": "material-symbols:person",
			"children": [
				{
					"name": "动态",
					"url": "/dynamic/",
					"icon": "material-symbols:forum-rounded",
					"pageKey": "dynamic"
				},
				{
					"name": "相册",
					"url": "/gallery/",
					"icon": "material-symbols:photo-library",
					"pageKey": "gallery"
				},
				{
					"name": "追番",
					"url": "/anime/",
					"icon": "material-symbols:live-tv",
					"pageKey": "anime"
				},
				{
					"name": "番组计划",
					"url": "/bangumi/",
					"icon": "material-symbols:movie",
					"pageKey": "bangumi"
				},
				{
					"name": "书签导航",
					"url": "/booknav/",
					"icon": "material-symbols:bookmarks",
					"pageKey": "booknav"
				}
			]
		},
		{
			"name": "关于",
			"url": "#",
			"icon": "material-symbols:info",
			"children": [
				{
					"name": "打赏",
					"url": "/sponsor/",
					"icon": "material-symbols:favorite",
					"pageKey": "sponsor"
				},
				{
					"name": "关于我",
					"url": "/about/",
					"icon": "material-symbols:person"
				}
			]
		},
		{
			"name": "链接",
			"url": "#",
			"icon": "material-symbols:link",
			"children": [
				{
					"name": "GitHub",
					"url": "https://github.com/sycg767",
					"external": true,
					"icon": "fa7-brands:github"
				},
				{
					"name": "Kaggle",
					"url": "https://www.kaggle.com/aurax7",
					"external": true,
					"icon": "fa7-brands:kaggle"
				}
			]
		}
	]
};
