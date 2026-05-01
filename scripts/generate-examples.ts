import fs from "node:fs";
import path from "node:path";
import { QrBit } from "../src/qrbit.js";
import { buildOptions, type ExampleSpec, examples } from "./examples.js";

const OUTPUT_DIR = "./examples";

async function ensureDirectory(dirPath: string): Promise<void> {
	if (!fs.existsSync(dirPath)) {
		await fs.promises.mkdir(dirPath, { recursive: true });
	}
}

async function generateExample(spec: ExampleSpec): Promise<void> {
	const qr = new QrBit(buildOptions(spec));
	const filename = path.join(OUTPUT_DIR, `${spec.name}.${spec.format}`);
	switch (spec.format) {
		case "png":
			await qr.toPngFile(filename, spec.toOptions);
			break;
		case "svg":
			await qr.toSvgFile(filename, spec.toOptions);
			break;
		case "jpg":
			await qr.toJpgFile(filename, spec.toOptions);
			break;
		case "webp":
			await qr.toWebpFile(filename, spec.toOptions);
			break;
	}
}

async function main(): Promise<void> {
	console.log("🚀 Starting QrBit example generation...\n");

	await ensureDirectory(OUTPUT_DIR);

	try {
		for (const spec of examples) {
			await generateExample(spec);
			console.log(`  ✓ ${spec.name}.${spec.format}`);
		}

		console.log(`\n✅ Generated ${examples.length} examples successfully!`);
		console.log(`📁 Check the '${OUTPUT_DIR}' directory for generated files.`);
	} catch (error) {
		console.error("❌ Error generating examples:", error);
		process.exit(1);
	}
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main();
}
