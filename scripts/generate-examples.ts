import fs from "node:fs";
import path from "node:path";
import { QrBit } from "../src/qrbit.js";

const OUTPUT_DIR = "./examples";
const LOGO_PATH = "./test/fixtures/test_logo.png";

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
	const urlQr = new QrBit({ text: "https://github.com/jaredwray/qrbit", size: 200 });
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
	
	// 6. Logo with small ratio
	const logoSmallQr = new QrBit({
		text: 'logo small',
		logo: LOGO_PATH,
		logoSizeRatio: 0.2,
	});
	await logoSmallQr.toPngFile(path.join(OUTPUT_DIR, "06_logo_small.png"));

	// 7. Logo with large ratio
	const logoLargeQr = new QrBit({
		text: 'logo large red',
		logo: LOGO_PATH,
		size: 400,
		logoSizeRatio: 0.3,
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

	// 10. Buffer logo example
	const logoBuffer = fs.readFileSync(LOGO_PATH);
	const bufferLogoQr = new QrBit({
		text,
		logo: logoBuffer,
		logoSizeRatio: 0.2,
		backgroundColor: "#F0F0F0",
		foregroundColor: "#333333",
	});
	await bufferLogoQr.toPngFile(path.join(OUTPUT_DIR, "10_buffer_logo.png"));
}

async function generateJpgExamples(): Promise<void> {
	console.log("📸 Generating JPEG examples...");

	// 11. Basic JPEG with high quality
	const jpgHighQr = new QrBit({
		text: "High Quality JPEG",
		size: 300,
	});
	await jpgHighQr.toJpgFile(path.join(OUTPUT_DIR, "11_jpg_high_quality.jpg"), { quality: 95 });

	// 12. JPEG with logo and custom quality
	const jpgLogoQr = new QrBit({
		text: "JPEG with Logo",
		logo: LOGO_PATH,
		size: 400,
		logoSizeRatio: 0.25,
		backgroundColor: "#2196F3",
		foregroundColor: "#FFFFFF",
	});
	await jpgLogoQr.toJpgFile(path.join(OUTPUT_DIR, "12_jpg_logo_blue.jpg"), { quality: 90 });

	// 13. Compressed JPEG for smaller file size
	const jpgCompressedQr = new QrBit({
		text: "https://github.com/jaredwray/qrbit",
		size: 300,
		backgroundColor: "#4CAF50",
		foregroundColor: "#FFFFFF",
	});
	await jpgCompressedQr.toJpgFile(path.join(OUTPUT_DIR, "13_jpg_compressed_green.jpg"), { quality: 70 });

	// 14. JPEG with buffer logo
	const logoBuffer = fs.readFileSync(LOGO_PATH);
	const jpgBufferQr = new QrBit({
		text: "JPEG Buffer Logo",
		logo: logoBuffer,
		size: 350,
		logoSizeRatio: 0.2,
		backgroundColor: "#FF9800",
		foregroundColor: "#FFFFFF",
	});
	await jpgBufferQr.toJpgFile(path.join(OUTPUT_DIR, "14_jpg_buffer_logo_orange.jpg"), { quality: 85 });
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
		await generateJpgExamples();

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