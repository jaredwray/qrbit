import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		coverage: {
			reporter: ["text", "json", "lcov"],
			include: ["src/qrbit.ts"],
			exclude: [
				"node_modules/",
				"src/native.js",
				"src/index.d.ts", 
				"src/lib.rs",
				"src/qrbit.*.node",
				"dist/",
				"*.config.*",
				"test/**/*",
			],
		},
		include: ["test/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
	},
});
