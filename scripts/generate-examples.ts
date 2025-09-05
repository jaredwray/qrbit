#!/usr/bin/env tsx

import fs from "node:fs";
import path from "node:path";
import { QrBit } from "../src/qrbit.js";

const OUTPUT_DIR = "./examples";
const LOGO_PATH = "./test/fixtures/test_logo.png";

// Example QR code text variations
const EXAMPLE_TEXTS = [
	"Hello World!",
	"https://github.com/jaredwray/qrbit",
	"mailto:hello@example.com",
	"tel:+1234567890",
	"WIFI:T:WPA;S:MyNetwork;P:MyPassword;;",
	"https://www.youtube.com/watch?v=dQw4w9WgXcQ",
];

// Size variations
const SIZES = [150, 200, 300, 500];

// Margin variations
const MARGINS = [10, 20, 40];

// Color combinations
const COLOR_COMBINATIONS = [
	{ bg: "#FFFFFF", fg: "#000000", name: "classic" },
	{ bg: "#000000", fg: "#FFFFFF", name: "inverted" },
	{ bg: "#FF0000", fg: "#FFFFFF", name: "red-bg" },
	{ bg: "#0000FF", fg: "#FFFFFF", name: "blue-bg" },
	{ bg: "#00FF00", fg: "#000000", name: "green-bg" },
	{ bg: "#FFFF00", fg: "#000000", name: "yellow-bg" },
	{ bg: "#FF00FF", fg: "#FFFFFF", name: "magenta-bg" },
	{ bg: "#00FFFF", fg: "#000000", name: "cyan-bg" },
];

// Logo size ratios
const LOGO_RATIOS = [0.1, 0.2, 0.3, 0.4];

async function ensureDirectory(dirPath: string): Promise<void> {
	if (!fs.existsSync(dirPath)) {
		await fs.promises.mkdir(dirPath, { recursive: true });
	}
}

async function generateBasicExamples(): Promise<void> {
	console.log("🎯 Generating basic examples...");
	
	const basicDir = path.join(OUTPUT_DIR, "basic");
	await ensureDirectory(basicDir);

	for (const text of EXAMPLE_TEXTS) {
		const safeName = text
			.replace(/[^a-zA-Z0-9]/g, "_")
			.substring(0, 30);
		
		const qr = new QrBit({ text });
		
		// Generate both SVG and PNG
		await qr.toSvgFile(path.join(basicDir, `${safeName}.svg`));
		await qr.toPngFile(path.join(basicDir, `${safeName}.png`));
	}
}

async function generateSizeExamples(): Promise<void> {
	console.log("📏 Generating size examples...");
	
	const sizeDir = path.join(OUTPUT_DIR, "sizes");
	await ensureDirectory(sizeDir);

	const text = "Size Examples";

	for (const size of SIZES) {
		const qr = new QrBit({ text, size });
		
		await qr.toSvgFile(path.join(sizeDir, `size_${size}px.svg`));
		await qr.toPngFile(path.join(sizeDir, `size_${size}px.png`));
	}
}

async function generateMarginExamples(): Promise<void> {
	console.log("📐 Generating margin examples...");
	
	const marginDir = path.join(OUTPUT_DIR, "margins");
	await ensureDirectory(marginDir);

	const text = "Margin Examples";

	for (const margin of MARGINS) {
		const qr = new QrBit({ text, margin });
		
		await qr.toSvgFile(path.join(marginDir, `margin_${margin}px.svg`));
		await qr.toPngFile(path.join(marginDir, `margin_${margin}px.png`));
	}
}

async function generateColorExamples(): Promise<void> {
	console.log("🎨 Generating color examples...");
	
	const colorDir = path.join(OUTPUT_DIR, "colors");
	await ensureDirectory(colorDir);

	const text = "Color Examples";

	for (const color of COLOR_COMBINATIONS) {
		const qr = new QrBit({
			text,
			backgroundColor: color.bg,
			foregroundColor: color.fg,
		});
		
		await qr.toSvgFile(path.join(colorDir, `color_${color.name}.svg`));
		await qr.toPngFile(path.join(colorDir, `color_${color.name}.png`));
	}
}

async function generateLogoExamples(): Promise<void> {
	console.log("🖼️  Generating logo examples...");
	
	const logoDir = path.join(OUTPUT_DIR, "logos");
	await ensureDirectory(logoDir);

	const text = "Logo Examples";

	// Check if logo file exists
	const qr = new QrBit({ text });
	const logoExists = await qr.logoFileExists(LOGO_PATH);
	
	if (!logoExists) {
		console.warn(`⚠️  Logo file not found at ${LOGO_PATH}, skipping logo examples`);
		return;
	}

	// Different logo sizes
	for (const ratio of LOGO_RATIOS) {
		const qrWithLogo = new QrBit({
			text,
			logo: LOGO_PATH,
			logoSizeRatio: ratio,
		});
		
		await qrWithLogo.toSvgFile(path.join(logoDir, `logo_ratio_${ratio}.svg`));
		await qrWithLogo.toPngFile(path.join(logoDir, `logo_ratio_${ratio}.png`));
	}

	// Logo with different colors
	for (const color of COLOR_COMBINATIONS.slice(0, 4)) { // Just first 4 colors
		const qrWithLogo = new QrBit({
			text,
			logo: LOGO_PATH,
			backgroundColor: color.bg,
			foregroundColor: color.fg,
		});
		
		await qrWithLogo.toSvgFile(path.join(logoDir, `logo_${color.name}.svg`));
		await qrWithLogo.toPngFile(path.join(logoDir, `logo_${color.name}.png`));
	}
}

async function generateCombinationExamples(): Promise<void> {
	console.log("🔄 Generating combination examples...");
	
	const comboDir = path.join(OUTPUT_DIR, "combinations");
	await ensureDirectory(comboDir);

	const text = "https://github.com/jaredwray/qrbit";

	// Create a few interesting combinations
	const combinations = [
		{
			name: "large_red_with_logo",
			options: {
				text,
				size: 400,
				margin: 30,
				backgroundColor: "#FF0000",
				foregroundColor: "#FFFFFF",
				logo: LOGO_PATH,
				logoSizeRatio: 0.25,
			},
		},
		{
			name: "small_blue_minimal",
			options: {
				text,
				size: 100,
				margin: 5,
				backgroundColor: "#0000FF",
				foregroundColor: "#FFFFFF",
			},
		},
		{
			name: "medium_green_with_large_logo",
			options: {
				text,
				size: 250,
				margin: 15,
				backgroundColor: "#00FF00",
				foregroundColor: "#000000",
				logo: LOGO_PATH,
				logoSizeRatio: 0.4,
			},
		},
	];

	for (const combo of combinations) {
		// Skip logo combinations if logo doesn't exist
		if (combo.options.logo) {
			const qr = new QrBit({ text });
			const logoExists = await qr.logoFileExists(LOGO_PATH);
			if (!logoExists) {
				delete combo.options.logo;
				delete combo.options.logoSizeRatio;
			}
		}

		const qr = new QrBit(combo.options);
		
		await qr.toSvgFile(path.join(comboDir, `${combo.name}.svg`));
		await qr.toPngFile(path.join(comboDir, `${combo.name}.png`));
	}
}

async function generateBufferLogoExample(): Promise<void> {
	console.log("💾 Generating buffer logo example...");
	
	const bufferDir = path.join(OUTPUT_DIR, "buffer-logo");
	await ensureDirectory(bufferDir);

	const text = "Buffer Logo Example";

	// Check if logo file exists first
	const qr = new QrBit({ text });
	const logoExists = await qr.logoFileExists(LOGO_PATH);
	
	if (!logoExists) {
		console.warn(`⚠️  Logo file not found at ${LOGO_PATH}, skipping buffer logo example`);
		return;
	}

	// Read logo as buffer
	const logoBuffer = fs.readFileSync(LOGO_PATH);
	
	const qrWithBufferLogo = new QrBit({
		text,
		logo: logoBuffer,
		logoSizeRatio: 0.2,
		backgroundColor: "#F0F0F0",
		foregroundColor: "#333333",
	});
	
	await qrWithBufferLogo.toSvgFile(path.join(bufferDir, "buffer_logo_example.svg"));
	await qrWithBufferLogo.toPngFile(path.join(bufferDir, "buffer_logo_example.png"));
}

async function generateReadme(): Promise<void> {
	const readmeContent = `# QrBit Examples

This directory contains various examples of QR codes generated using QrBit.

## Directory Structure

- **basic/**: Simple QR codes with different text content
- **sizes/**: QR codes with different pixel sizes (${SIZES.join(', ')} px)
- **margins/**: QR codes with different margin sizes (${MARGINS.join(', ')} px)
- **colors/**: QR codes with different color combinations
- **logos/**: QR codes with embedded logos at different sizes and colors
- **combinations/**: Complex examples combining multiple options
- **buffer-logo/**: Example using logo from Buffer instead of file path

## Generated Variations

### Text Content
${EXAMPLE_TEXTS.map(text => `- ${text}`).join('\n')}

### Size Variations
${SIZES.map(size => `- ${size}x${size} pixels`).join('\n')}

### Margin Variations
${MARGINS.map(margin => `- ${margin} pixels margin`).join('\n')}

### Color Combinations
${COLOR_COMBINATIONS.map(color => `- **${color.name}**: Background ${color.bg}, Foreground ${color.fg}`).join('\n')}

### Logo Size Ratios
${LOGO_RATIOS.map(ratio => `- ${ratio} (${Math.round(ratio * 100)}% of QR code size)`).join('\n')}

## Usage

These examples demonstrate the flexibility and capabilities of QrBit:

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
		await generateBasicExamples();
		await generateSizeExamples();
		await generateMarginExamples();
		await generateColorExamples();
		await generateLogoExamples();
		await generateCombinationExamples();
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
if (require.main === module) {
	main();
}