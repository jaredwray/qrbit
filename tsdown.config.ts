import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["src/qrbit.ts"],
	format: ["cjs", "esm"],
	dts: true,
	sourcemap: true,
	clean: true,
	outDir: "dist",
	outExtensions: ({ format }) => ({
		js: format === "cjs" ? ".cjs" : ".js",
		dts: format === "cjs" ? ".d.cts" : ".d.ts",
	}),
	deps: {
		neverBundle: ["./native.js", "./native.cjs"],
	},
	hooks: {
		"build:done": async () => {
			const fs = await import("node:fs");
			const path = await import("node:path");
			const cjsFile = path.join("dist", "qrbit.cjs");
			if (fs.existsSync(cjsFile)) {
				let content = fs.readFileSync(cjsFile, "utf8");
				content = content.replace(
					/require\(["']\.\/native\.js["']\)/g,
					'require("./native.cjs")',
				);
				fs.writeFileSync(cjsFile, content, "utf8");
			}
		},
	},
});
