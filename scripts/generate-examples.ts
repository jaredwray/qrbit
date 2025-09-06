#!/usr/bin/env tsx

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { QrBit } from "../src/qrbit.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = "./examples";
const LOGO_PATH = "./test/fixtures/test_logo.png";

// Example QR code text variations
const EXAMPLE_TEXTS = [
	"Hello World!",
	"https://github.com/jaredwray/qrbit",
];

// Size variations
const SIZES = [200, 400];

// Color combinations
const COLOR_COMBINATIONS = [
	{ bg: "#FFFFFF", fg: "#000000", name: "classic" },
	{ bg: "#000000", fg: "#FFFFFF", name: "inverted" },
	{ bg: "#FF0000", fg: "#FFFFFF", name: "red-bg" },
];

// Logo size ratios
const LOGO_RATIOS = [0.2, 0.4];

async function ensureDirectory(dirPath: string): Promise<void> {
	if (!fs.existsSync(dirPath)) {
		await fs.promises.mkdir(dirPath, { recursive: true });
	}
}

async function generateCoreExamples(): Promise<void> {
	console.log("🎯 Generating core examples...");
	
	await ensureDirectory(OUTPUT_DIR);

	// 1. Basic QR code
	const basicQr = new QrBit({ text: "Hello World!" });
	await basicQr.toPngFile(path.join(OUTPUT_DIR, "01_basic.png"));

	// 2. URL QR code 
	const urlQr = new QrBit({ text: "https://github.com/jaredwray/qrbit" });
	await urlQr.toSvgFile(path.join(OUTPUT_DIR, "02_url.svg"));

	// 3. Large size
	const largeQr = new QrBit({ text: "Large QR", size: 400 });
	await largeQr.toPngFile(path.join(OUTPUT_DIR, "03_large_size.png"));

	// 4. Inverted colors
	const invertedQr = new QrBit({
		text: "Inverted Colors",
		backgroundColor: "#000000",
		foregroundColor: "#FFFFFF",
	});
	await invertedQr.toSvgFile(path.join(OUTPUT_DIR, "04_inverted.svg"));

	// 5. Red theme
	const redQr = new QrBit({
		text: "Red Theme",
		backgroundColor: "#FF0000",
		foregroundColor: "#FFFFFF",
	});
	await redQr.toPngFile(path.join(OUTPUT_DIR, "05_red_theme.png"));
}

async function generateLogoExamples(): Promise<void> {
	console.log("🖼️  Generating logo examples...");
	
	const text = "Logo Examples";

	// Check if logo file exists
	const qr = new QrBit({ text });
	const logoExists = await qr.logoFileExists(LOGO_PATH);
	
	if (!logoExists) {
		console.warn(`⚠️  Logo file not found at ${LOGO_PATH}, skipping logo examples`);
		return;
	}

	// 6. Logo with small ratio
	const logoSmallQr = new QrBit({
		text,
		logo: LOGO_PATH,
		logoSizeRatio: 0.2,
	});
	await logoSmallQr.toPngFile(path.join(OUTPUT_DIR, "06_logo_small.png"));

	// 7. Logo with large ratio
	const logoLargeQr = new QrBit({
		text,
		logo: LOGO_PATH,
		logoSizeRatio: 0.4,
		backgroundColor: "#FF0000",
		foregroundColor: "#FFFFFF",
	});
	await logoLargeQr.toSvgFile(path.join(OUTPUT_DIR, "07_logo_large_red.svg"));
}

async function generateSpecialExamples(): Promise<void> {
	console.log("🔄 Generating special examples...");
	
	const text = "https://github.com/jaredwray/qrbit";

	// 8. WiFi QR code
	const wifiQr = new QrBit({ 
		text: "WIFI:T:WPA;S:MyNetwork;P:MyPassword;;" 
	});
	await wifiQr.toPngFile(path.join(OUTPUT_DIR, "08_wifi.png"));

	// 9. Large with custom margin
	const largeMarginQr = new QrBit({
		text,
		size: 300,
		margin: 40,
		backgroundColor: "#0000FF",
		foregroundColor: "#FFFFFF",
	});
	await largeMarginQr.toSvgFile(path.join(OUTPUT_DIR, "09_large_margin_blue.svg"));
}

async function generateBufferLogoExample(): Promise<void> {
	console.log("💾 Generating buffer logo example...");
	
	const text = "Buffer Logo";

	// Check if logo file exists first
	const qr = new QrBit({ text });
	const logoExists = await qr.logoFileExists(LOGO_PATH);
	
	if (!logoExists) {
		console.warn(`⚠️  Logo file not found at ${LOGO_PATH}, skipping buffer logo example`);
		return;
	}

	// 10. Buffer logo example
	const logoBuffer = fs.readFileSync(LOGO_PATH);
	const bufferLogoQr = new QrBit({
		text,
		logo: logoBuffer,
		logoSizeRatio: 0.3,
		backgroundColor: "#F0F0F0",
		foregroundColor: "#333333",
	});
	await bufferLogoQr.toPngFile(path.join(OUTPUT_DIR, "10_buffer_logo.png"));
}

async function generateReadme(): Promise<void> {
	const readmeContent = `# QrBit Examples

This directory contains 10 curated examples showcasing QrBit's key features.

## Examples Generated

1. **01_basic.png** - Simple "Hello World!" QR code
2. **02_url.svg** - GitHub repository URL in SVG format  
3. **03_large_size.png** - Large 400px QR code
4. **04_inverted.svg** - White on black (inverted colors)
5. **05_red_theme.png** - Red background theme
6. **06_logo_small.png** - QR code with small logo (20%)
7. **07_logo_large_red.svg** - QR code with large logo (40%) and red theme
8. **08_wifi.png** - WiFi connection QR code
9. **09_large_margin_blue.svg** - Large QR with custom margin and blue theme  
10. **10_buffer_logo.png** - QR code using logo from Buffer (not file path)

## Key Features Demonstrated

- 📝 **Multiple formats**: Both PNG and SVG output
- 📏 **Size control**: From default 200px to large 400px
- 🎨 **Color themes**: Classic, inverted, and custom colors
- 🖼️  **Logo embedding**: File path and Buffer-based logos
- 📐 **Margin control**: Various spacing options
- 🔗 **Content types**: Text, URLs, WiFi credentials

## Usage

\`\`\`typescript
import { QrBit } from "qrbit";

// Basic usage
const qr = new QrBit({ text: "Hello World!" });
await qr.toPngFile("output.png");

// With logo and custom colors  
const qrWithLogo = new QrBit({
    text: "https://github.com/jaredwray/qrbit",
    logo: "./logo.png",
    backgroundColor: "#FF0000", 
    foregroundColor: "#FFFFFF",
    logoSizeRatio: 0.2
});

await qrWithLogo.toSvgFile("output.svg");
\`\`\`

Generated with QrBit v${process.env.npm_package_version || '0.1.0'}
`;

	await fs.promises.writeFile(path.join(OUTPUT_DIR, "README.md"), readmeContent);
}

async function main(): Promise<void> {
	console.log("🚀 Starting QrBit example generation...\n");

	// Ensure output directory exists
	await ensureDirectory(OUTPUT_DIR);

	try {
		await generateCoreExamples();
		await generateLogoExamples();
		await generateSpecialExamples();
		await generateBufferLogoExample();
		await generateReadme();

		console.log("\n✅ All examples generated successfully!");
		console.log(`📁 Check the '${OUTPUT_DIR}' directory for generated files.`);
	} catch (error) {
		console.error("❌ Error generating examples:", error);
		process.exit(1);
	}
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
	main();
}