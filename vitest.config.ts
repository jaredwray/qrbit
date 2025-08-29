import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		coverage: {
			reporter: ["text", "json", "lcov"],
			exclude: [
				"node_modules/",
				"dist/",
				"*.config.*",
				"src/**/*.d.ts",
				"test/**/*",
			],
		},
		include: ["test/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
	},
});
