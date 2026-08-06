import type { MusicPlayerConfig } from "../types/musicConfig";

// 音乐播放器配置
export const musicPlayerConfig: MusicPlayerConfig = {
	// 是否在导航栏显示音乐播放器入口
	showInNavbar: true,

	// 是否在侧边栏显示音乐播放器组件
	showInSidebar: true,

	// 使用方式："meting" 使用 Meting API，"local" 使用本地音乐列表
	mode: "local",

	// 默认音量 (0-1)
	volume: 0.7,

	// 播放模式：'list'=列表循环, 'one'=单曲循环, 'random'=随机播放
	playMode: "list",

	// 是否显启用歌词
	showLyrics: true,

	// Meting API 配置
	meting: {
		// Meting API 地址
		// 默认使用官方 API，也可以使用自定义 API
		api: "https://api.i-meto.com/meting/api?server=:server&type=:type&id=:id&r=:r",
		// 音乐平台：netease=网易云音乐, tencent=QQ音乐, kugou=酷狗音乐, xiami=虾米音乐, baidu=百度音乐
		server: "netease",
		// 类型：song=单曲, playlist=歌单, album=专辑, search=搜索, artist=艺术家
		type: "playlist",
		// 歌单/专辑/单曲 ID 或搜索关键词
		id: "10046455237",
		// 认证 token（可选）
		auth: "",
		// 备用 API 配置（当主 API 失败时使用）
		fallbackApis: [
			"https://api.injahow.cn/meting/?server=:server&type=:type&id=:id",
			"https://api.moeyao.cn/meting/?server=:server&type=:type&id=:id",
		],
	},

	// 本地音乐配置（当 mode 为 'local' 时使用）
	// 1. 支持传入歌词文件的路径
	// lrc: "/assets/music/lrc/使一颗心免于哀伤-哼唱.lrc",
	// 2. 或者直接填入歌词字符串内容
	// lrc: "[00:00.00]歌词内容...",
	local: {
		// 本地歌曲没有 lrc 时，通过现有 Meting 接口搜索真实歌词
		fetchLyrics: true,

		playlist: [
			{
				name: "无法回到过去 (男声版)",
				artist: "BGM乐乐",
				url: "/assets/music/BGM乐乐 - 无法回到过去 (男声版).mp3",
				cover: "/assets/music/cover/local-001.jpg",
				lrc: "",
			},
			{
				name: "Superstar (Miami Classic Mix)",
				artist: "Chris Decay、ELLA",
				url: "/assets/music/Chris Decay、ELLA - Superstar (Miami Classic Mix).mp3",
				cover: "/assets/music/cover/local-002.jpg",
				lrc: "",
			},
			{
				name: "下坠Falling",
				artist: "Corki刘宗鑫",
				url: "/assets/music/Corki刘宗鑫 - 下坠Falling.mp3",
				cover: "/assets/music/cover/local-003.jpg",
				lrc: "",
			},
			{
				name: "Remember Our Summer",
				artist: "FrogMonster",
				url: "/assets/music/FrogMonster - Remember Our Summer.mp3",
				cover: "/assets/music/cover/local-004.jpg",
				lrc: "",
			},
			{
				name: "龙卷风",
				artist: "G.E.M. 邓紫棋",
				url: "/assets/music/G.E.M. 邓紫棋 - 龙卷风.mp3",
				cover: "/assets/music/cover/local-005.jpg",
				lrc: "",
			},
			{
				name: "Wake (Studio)",
				artist: "Hillsong Young & Free",
				url: "/assets/music/Hillsong Young & Free - Wake (Studio).mp3",
				cover: "/assets/music/cover/local-006.jpg",
				lrc: "",
			},
			{
				name: "Wake (Live)",
				artist: "Hillsong Young & Free、TAYA",
				url: "/assets/music/Hillsong Young & Free、TAYA - Wake (Live).mp3",
				cover: "/assets/music/cover/local-007.jpg",
				lrc: "",
			},
			{
				name: "Letter That Writing in the Wind (写在风中的信)",
				artist: "July",
				url: "/assets/music/July - Letter That Writing in the Wind (写在风中的信).mp3",
				cover: "/assets/music/cover/local-008.jpg",
				lrc: "",
			},
			{
				name: "记念",
				artist: "RAiNBOW计划、雷雨心",
				url: "/assets/music/RAiNBOW计划、雷雨心 - 记念.mp3",
				cover: "/assets/music/cover/local-009.jpg",
				lrc: "",
			},
			{
				name: "泡沫 (remix：Swang)",
				artist: "Swang多雷",
				url: "/assets/music/Swang多雷 - 泡沫 (remix：Swang).mp3",
				cover: "/assets/music/cover/default-music-cover.webp",
				lrc: "",
			},
			{
				name: "Fly Away",
				artist: "TheFatRat、Anjulie",
				url: "/assets/music/TheFatRat、Anjulie - Fly Away.mp3",
				cover: "/assets/music/cover/local-011.jpg",
				lrc: "",
			},
			{
				name: "不爱又何必纠缠",
				artist: "阿夏、蛋董",
				url: "/assets/music/阿夏、蛋董 - 不爱又何必纠缠.mp3",
				cover: "/assets/music/cover/default-music-cover.webp",
				lrc: "",
			},
			{
				name: "王候将相本无种 (纯享版)",
				artist: "暴躁小猪",
				url: "/assets/music/暴躁小猪 - 王候将相本无种 (纯享版).mp3",
				cover: "/assets/music/cover/local-013.jpg",
				lrc: "",
			},
			{
				name: "日不落",
				artist: "蔡依林",
				url: "/assets/music/蔡依林 - 日不落.mp3",
				cover: "/assets/music/cover/local-014.jpg",
				lrc: "",
			},
			{
				name: "四块五",
				artist: "椴炼",
				url: "/assets/music/椴炼 - 四块五.mp3",
				cover: "/assets/music/cover/local-015.jpg",
				lrc: "",
			},
			{
				name: "哪里都是你",
				artist: "队长",
				url: "/assets/music/队长 - 哪里都是你.mp3",
				cover: "/assets/music/cover/local-016.jpg",
				lrc: "",
			},
			{
				name: "云烟成雨",
				artist: "房东的猫",
				url: "/assets/music/房东的猫 - 云烟成雨.mp3",
				cover: "/assets/music/cover/local-017.jpg",
				lrc: "",
			},
			{
				name: "我们俩",
				artist: "郭顶",
				url: "/assets/music/郭顶 - 我们俩.mp3",
				cover: "/assets/music/cover/local-018.jpg",
				lrc: "",
			},
			{
				name: "黎明前的黑暗",
				artist: "郝琪力、书岩",
				url: "/assets/music/郝琪力、书岩 - 黎明前的黑暗.mp3",
				cover: "/assets/music/cover/local-019.jpg",
				lrc: "",
			},
			{
				name: "盗将行",
				artist: "花粥",
				url: "/assets/music/花粥 - 盗将行.mp3",
				cover: "/assets/music/cover/local-020.jpg",
				lrc: "",
			},
			{
				name: "岁月神偷 (Demo)",
				artist: "金玟岐",
				url: "/assets/music/金玟岐 - 岁月神偷 (Demo).mp3",
				cover: "/assets/music/cover/local-021.jpg",
				lrc: "",
			},
			{
				name: "这一生关于你的风景 (DJ)",
				artist: "枯木逢春",
				url: "/assets/music/枯木逢春 - 这一生关于你的风景 (DJ).mp3",
				cover: "/assets/music/cover/default-music-cover.webp",
				lrc: "",
			},
			{
				name: "这一生关于你的风景",
				artist: "枯木逢春",
				url: "/assets/music/枯木逢春 - 这一生关于你的风景.mp3",
				cover: "/assets/music/cover/local-023.jpg",
				lrc: "",
			},
			{
				name: "同桌的你",
				artist: "老狼",
				url: "/assets/music/老狼 - 同桌的你.mp3",
				cover: "/assets/music/cover/local-024.jpg",
				lrc: "",
			},
			{
				name: "不遗憾",
				artist: "李荣浩",
				url: "/assets/music/李荣浩 - 不遗憾.mp3",
				cover: "/assets/music/cover/local-025.jpg",
				lrc: "",
			},
			{
				name: "时间的过客",
				artist: "李伊曼",
				url: "/assets/music/李伊曼 - 时间的过客.mp3",
				cover: "/assets/music/cover/local-026.jpg",
				lrc: "",
			},
			{
				name: "木兰",
				artist: "李宇春",
				url: "/assets/music/李宇春 - 木兰.mp3",
				cover: "/assets/music/cover/local-027.jpg",
				lrc: "",
			},
			{
				name: "起风了 (Live)",
				artist: "林俊杰",
				url: "/assets/music/林俊杰 - 起风了 (Live).mp3",
				cover: "/assets/music/cover/default-music-cover.webp",
				lrc: "",
			},
			{
				name: "心跳的证明",
				artist: "刘人语",
				url: "/assets/music/刘人语 - 心跳的证明.mp3",
				cover: "/assets/music/cover/local-029.jpg",
				lrc: "",
			},
			{
				name: "后来",
				artist: "刘若英",
				url: "/assets/music/刘若英 - 后来.mp3",
				cover: "/assets/music/cover/local-030.jpg",
				lrc: "",
			},
			{
				name: "东京不太热 (DJ Z新豪版)",
				artist: "洛天依、Z新豪",
				url: "/assets/music/洛天依、Z新豪 - 东京不太热 (DJ Z新豪版).mp3",
				cover: "/assets/music/cover/local-031.jpg",
				lrc: "",
			},
			{
				name: "起风了",
				artist: "买辣椒也用券",
				url: "/assets/music/买辣椒也用券 - 起风了.mp3",
				cover: "/assets/music/cover/local-032.jpg",
				lrc: "",
			},
			{
				name: "像我这样的人 (Live)",
				artist: "毛不易、徐航",
				url: "/assets/music/毛不易、徐航 - 像我这样的人 (Live).mp3",
				cover: "/assets/music/cover/local-033.jpg",
				lrc: "",
			},
			{
				name: "暖一杯茶",
				artist: "邵帅",
				url: "/assets/music/邵帅 - 暖一杯茶.mp3",
				cover: "/assets/music/cover/local-034.jpg",
				lrc: "",
			},
			{
				name: "盗将行",
				artist: "沈小柒、尼亚",
				url: "/assets/music/沈小柒、尼亚 - 盗将行.mp3",
				cover: "/assets/music/cover/local-035.jpg",
				lrc: "",
			},
			{
				name: "一个人想着一个人 (DJ苏天伦版)",
				artist: "苏天伦、曾沛慈",
				url: "/assets/music/苏天伦、曾沛慈 - 一个人想着一个人 (DJ苏天伦版).mp3",
				cover: "/assets/music/cover/local-036.jpg",
				lrc: "",
			},
			{
				name: "Lutra",
				artist: "太一",
				url: "/assets/music/太一 - Lutra.mp3",
				cover: "/assets/music/cover/local-037.jpg",
				lrc: "",
			},
			{
				name: "你走以后",
				artist: "王恩信Est、二胖u",
				url: "/assets/music/王恩信Est、二胖u - 你走以后.mp3",
				cover: "/assets/music/cover/local-038.jpg",
				lrc: "",
			},
			{
				name: "你走以后1.0",
				artist: "王恩信Est、二胖u",
				url: "/assets/music/王恩信Est、二胖u - 你走以后1.0.mp3",
				cover: "/assets/music/cover/local-039.jpg",
				lrc: "",
			},
			{
				name: "不是因为寂寞才想你",
				artist: "王小帅",
				url: "/assets/music/王小帅 - 不是因为寂寞才想你.mp3",
				cover: "/assets/music/cover/local-040.jpg",
				lrc: "",
			},
			{
				name: "迷失幻境 (DJ版)",
				artist: "王忻辰",
				url: "/assets/music/王忻辰 - 迷失幻境 (DJ版).mp3",
				cover: "/assets/music/cover/local-041.jpg",
				lrc: "",
			},
			{
				name: "大田后生仔 (DJ女生版)",
				artist: "王雨笙",
				url: "/assets/music/王雨笙 - 大田后生仔 (DJ女生版).mp3",
				cover: "/assets/music/cover/local-042.jpg",
				lrc: "",
			},
			{
				name: "如果可以 (反感1.3x版)",
				artist: "韦礼安",
				url: "/assets/music/韦礼安 - 如果可以 (反感1.3x版).mp3",
				cover: "/assets/music/cover/default-music-cover.webp",
				lrc: "",
			},
			{
				name: "一样的月光",
				artist: "徐佳莹",
				url: "/assets/music/徐佳莹 - 一样的月光.mp3",
				cover: "/assets/music/cover/local-044.jpg",
				lrc: "",
			},
			{
				name: "根本你不懂得爱我",
				artist: "音河",
				url: "/assets/music/音河 - 根本你不懂得爱我.mp3",
				cover: "/assets/music/cover/local-045.jpg",
				lrc: "",
			},
			{
				name: "侧脸",
				artist: "于果",
				url: "/assets/music/于果 - 侧脸.mp3",
				cover: "/assets/music/cover/local-046.jpg",
				lrc: "",
			},
			{
				name: "骄傲的选择",
				artist: "张杰、QQ飞车",
				url: "/assets/music/张杰、QQ飞车 - 骄傲的选择.mp3",
				cover: "/assets/music/cover/local-047.jpg",
				lrc: "",
			},
			{
				name: "迷人的危险",
				artist: "张颖轩、范茹",
				url: "/assets/music/张颖轩、范茹 - 迷人的危险.mp3",
				cover: "/assets/music/cover/local-048.jpg",
				lrc: "",
			},
			{
				name: "送你一朵小红花",
				artist: "赵英俊",
				url: "/assets/music/赵英俊 - 送你一朵小红花.mp3",
				cover: "/assets/music/cover/local-049.jpg",
				lrc: "",
			},
		],
	},
};
