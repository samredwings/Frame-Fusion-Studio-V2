//#region node_modules/.nitro/vite/services/ssr/assets/_tanstack-start-manifest_v-BzrJu1CK.js
var tsrStartManifest = () => ({ routes: {
	__root__: {
		filePath: "/workspace/src/routes/__root.tsx",
		children: ["/", "/projects/$projectId"],
		preloads: [
			"/assets/index-DP8RL24A.js",
			"/assets/rolldown-runtime-CbXtAM7H.js",
			"/assets/store-CEYnw4Z-.js",
			"/assets/preload-helper-CIxDPn9_.js"
		],
		scripts: [{ attrs: {
			type: "module",
			async: !0,
			src: "/assets/index-DP8RL24A.js"
		} }]
	},
	"/": {
		filePath: "/workspace/src/routes/index.tsx",
		children: void 0,
		preloads: ["/assets/routes-BZPYgRcr.js", "/assets/ui-D1-BlkT8.js"]
	},
	"/projects/$projectId": {
		filePath: "/workspace/src/routes/projects.$projectId.tsx",
		children: ["/projects/$projectId/settings"],
		preloads: [
			"/assets/projects._projectId-BAWoWeCl.js",
			"/assets/ui-D1-BlkT8.js",
			"/assets/trash-2-D4294Kr2.js"
		]
	},
	"/projects/$projectId/settings": {
		filePath: "/workspace/src/routes/projects.$projectId.settings.tsx",
		children: void 0,
		preloads: ["/assets/projects._projectId.settings-DoU3qfQ9.js"]
	}
} });
//#endregion
export { tsrStartManifest };
