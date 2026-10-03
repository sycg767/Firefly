import type { BackgroundWallpaperConfig } from "@/types/backgroundWallpaper";

export const backgroundWallpaper: BackgroundWallpaperConfig = {
	mode: "banner",
	playerEnable: true,
	src: {
		desktop: [
			"assets/images/DesktopWallpaper/vesper-d1.webp",
			"assets/images/DesktopWallpaper/vesper-d2.webp",
		],
		mobile: [
			"assets/images/MobileWallpaper/vesper-m1.webp",
			"assets/images/MobileWallpaper/vesper-m2.webp",
		],
		playerUrl: "https://bed.twoleaf.cn/file/1785658612716_firefly.mp4",
	},
	common: {
		dimOpacity: 0.2,
		playerMode: "random",
		homeText: {
			enable: true,
			displayMode: "ambient",
			subtitle: [
				"风从很远的地方来，\n又向很远的地方去。",
				"月光落进窗里，\n夜晚便有了回声。",
				"山水一程，\n幸与清风作伴。",
				"把寻常的日子，\n慢慢过成喜欢的模样。",
				"天色将晚，\n故事正好开始。",
				"有些花开得很慢，\n但从不辜负春天。",
				"愿每一次出发，\n都能遇见新的风景。",
				"日子不必总有答案，\n偶尔只需经过。",
				"人间缓慢，\n仍值得认真生活。",
				"旧梦留在昨日，\n晚风吹向明天。",
				"云会散，月会来，\n故事还会继续。",
				"在漫长的岁月里，\n收藏一点微小的欢喜。",
			],
			rotationInterval: 9000,
		},
		postInfo: {
			mode: "description",
		},
		navbar: {
			transparentMode: "semi",
			blur: 5,
		},
		waves: {
			enable: {
				desktop: true,
				mobile: true,
			},
		},
		gradient: {
			enable: {
				desktop: true,
				mobile: true,
			},
			height: "10%",
		},
		carousel: {
			enable: true,
			interval: 12000,
			transitionEffect: "fade",
		},
	},
	banner: {
		position: "50% 20%",
	},
	overlay: {
		zIndex: -1,
		opacity: 0.8,
		blur: 10,
		cardOpacity: 0.5,
	},
	fullscreen: {
		position: "center",
	},
};
