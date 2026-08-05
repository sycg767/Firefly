import type { BooknavGroup, BooknavPageConfig } from "../types/booknavConfig";

// 书签导航页面配置
export const booknavPageConfig: BooknavPageConfig = {
	"title": "",
	"description": "",
	"favicon": {
		"enabled": true,
		"api": "https://a.favicon.im/{domain}"
	}
};

// 书签导航配置
// 每个数组项是一个分类组，分类组内的 items 是该分类下的书签
export const booknavConfig: BooknavGroup[] = [
	{
		"id": "dev",
		"name": "开发",
		"icon": "material-symbols:code-rounded",
		"desc": "写代码时离不开的站点",
		"weight": 90,
		"items": [
			{
				"title": "GitHub",
				"url": "https://github.com",
				"desc": "全球最大的代码托管平台",
				"icon": "fa7-brands:github",
				"weight": 10
			}
		]
	},
	{
		"id": "community",
		"name": "技术社区",
		"icon": "material-symbols:forum-outline-rounded",
		"desc": "汇集开发者经验、技术讨论与实践交流",
		"weight": 100,
		"items": [
			{
				"title": "Linux.do",
				"url": "https://linux.do/",
				"desc": "围绕 Linux、AI、编程与服务器的技术交流社区",
				"weight": 10
			}
		]
	},
	{
		"id": "design",
		"name": "设计",
		"icon": "material-symbols:palette-outline-rounded",
		"desc": "配色、图标与灵感来源",
		"weight": 80,
		"items": [
			{
				"title": "Iconify",
				"url": "https://icon-sets.iconify.design",
				"desc": "海量开源图标集合搜索",
				"weight": 10
			},
			{
				"title": "iconfont",
				"url": "https://www.iconfont.cn",
				"desc": "阿里巴巴矢量图标库",
				"weight": 9
			}
		]
	},
	{
		"id": "tools",
		"name": "工具",
		"icon": "material-symbols:build-outline-rounded",
		"desc": "顺手的在线小工具",
		"weight": 95,
		"items": [
			{
				"title": "ToolHelper",
				"url": "https://www.toolhelper.cn/",
				"desc": "实用的在线工具集合",
				"weight": 10
			}
		]
	},
	{
		"id": "resources",
		"name": "资源",
		"icon": "material-symbols:auto-stories-outline-rounded",
		"desc": "文档、教程与阅读",
		"weight": 70,
		"items": [
			{
				"title": "Firefly Docs",
				"url": "https://docs-firefly.cuteleaf.cn",
				"desc": "Firefly 主题模板文档",
				"icon": "https://docs-firefly.cuteleaf.cn/logo.png",
				"weight": 10
			}
		]
	}
];
