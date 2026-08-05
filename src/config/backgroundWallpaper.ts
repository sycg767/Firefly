import type { BackgroundWallpaperConfig } from "@/types/backgroundWallpaper";

export const backgroundWallpaper: BackgroundWallpaperConfig = {
	"mode": "banner",
	"playerEnable": true,
	"src": {
		"desktop": [
			"assets/images/DesktopWallpaper/vesper-d1.webp",
			"assets/images/DesktopWallpaper/vesper-d2.webp"
		],
		"mobile": [
			"assets/images/MobileWallpaper/vesper-m1.webp",
			"assets/images/MobileWallpaper/vesper-m2.webp"
		],
		"playerUrl": "https://bed.twoleaf.cn/file/1785658612716_firefly.mp4"
	},
	"common": {
		"dimOpacity": 0.2,
		"playerMode": "random",
		"homeText": {
			"enable": true,
			"title": "Vesper Afterglow",
			"titleSize": "4.5rem",
			"subtitle": [
				"In Reddened Chrysalis, I Once Rest",
				"From Shattered Sky, I Free Fall",
				"Amidst Silenced Stars, I Deep Sleep",
				"Upon Lighted Fyrefly, I Soon Gaze",
				"From Undreamt Night, I Thence Shine",
				"In Finalized Morrow, I Full Bloom"
			],
			"subtitleSize": "1.5rem",
			"typewriter": {
				"enable": true,
				"speed": 100,
				"deleteSpeed": 50,
				"pauseTime": 2000
			}
		},
		"postInfo": {
			"mode": "description"
		},
		"navbar": {
			"transparentMode": "semi",
			"blur": 5
		},
		"waves": {
			"enable": {
				"desktop": true,
				"mobile": true
			}
		},
		"gradient": {
			"enable": {
				"desktop": true,
				"mobile": true
			},
			"height": "10%"
		},
		"carousel": {
			"enable": true,
			"interval": 12000,
			"transitionEffect": "fade"
		}
	},
	"banner": {
		"position": "50% 20%"
	},
	"overlay": {
		"zIndex": -1,
		"opacity": 0.8,
		"blur": 10,
		"cardOpacity": 0.5
	},
	"fullscreen": {
		"position": "center"
	}
};
