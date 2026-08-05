import type { ProfileConfig } from "../types/profileConfig";

export const profileConfig: ProfileConfig = {
	avatar: "assets/images/avatar.jpg",
	name: "Aurax",
	bio: "Hello, I'm Aurax.",
	links: [
		{
			name: "GitHub",
			icon: "fa7-brands:github",
			url: "https://github.com/sycg767",
			showName: false,
		},
		{
			name: "Kaggle",
			icon: "fa7-brands:kaggle",
			url: "https://www.kaggle.com/aurax7",
			showName: false,
		},
		{
			name: "Email",
			icon: "fa7-solid:envelope",
			url: "mailto:aurax767@gmail.com",
			showName: false,
		},
	],
};
