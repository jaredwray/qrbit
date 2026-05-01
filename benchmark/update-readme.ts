import { spawnSync } from "node:child_process";
import fs from "node:fs";

type BenchmarkSection = {
	id: string;
	script: string;
};

const SECTIONS: BenchmarkSection[] = [
	{ id: "svg", script: "benchmark/qrcode-svg.ts" },
	{ id: "png", script: "benchmark/qrcode-png.ts" },
	{ id: "jpg", script: "benchmark/qrcode-jpg.ts" },
	{ id: "webp", script: "benchmark/qrcode-webp.ts" },
	{ id: "logo", script: "benchmark/qrcode-logo.ts" },
];

const README_PATH = "README.md";

function runBenchmark(script: string): string {
	const result = spawnSync("pnpm", ["exec", "tsx", script], {
		encoding: "utf8",
		stdio: ["inherit", "pipe", "inherit"],
		shell: true,
	});
	if (result.error) {
		throw result.error;
	}
	if (result.status !== 0) {
		throw new Error(`${script} exited with status ${result.status}`);
	}
	return result.stdout.trim();
}

function replaceSection(
	readme: string,
	id: string,
	content: string,
): string {
	const startMarker = `<!-- BENCHMARK:${id}:START -->`;
	const endMarker = `<!-- BENCHMARK:${id}:END -->`;
	const startIdx = readme.indexOf(startMarker);
	const endIdx = readme.indexOf(endMarker);
	if (startIdx === -1 || endIdx === -1) {
		throw new Error(
			`Markers ${startMarker}/${endMarker} not found in ${README_PATH}`,
		);
	}
	const before = readme.slice(0, startIdx + startMarker.length);
	const after = readme.slice(endIdx);
	return `${before}\n${content}\n${after}`;
}

let readme = fs.readFileSync(README_PATH, "utf8");

for (const { id, script } of SECTIONS) {
	console.log(`\n▶ ${script}`);
	const output = runBenchmark(script);
	process.stdout.write(`${output}\n`);
	readme = replaceSection(readme, id, output);
}

fs.writeFileSync(README_PATH, readme);
console.log(`\n✅ Updated benchmark sections in ${README_PATH}`);
