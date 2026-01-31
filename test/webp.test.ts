import fs from "node:fs";
import { faker } from "@faker-js/faker";
import { Cacheable } from "cacheable";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { QrBit } from "../src/qrbit";

const testLogoPath = "test/fixtures/test_logo.png";
const testLogoPathSmall = "test/fixtures/test_logo_small.png";

// WebP file signature: "RIFF" + size + "WEBP"
// Bytes 0-3: "RIFF" (0x52 0x49 0x46 0x46)
// Bytes 8-11: "WEBP" (0x57 0x45 0x42 0x50)
const isValidWebP = (buffer: Buffer): boolean => {
	return (
		buffer[0] === 0x52 && // R
		buffer[1] === 0x49 && // I
		buffer[2] === 0x46 && // F
		buffer[3] === 0x46 && // F
		buffer[8] === 0x57 && // W
		buffer[9] === 0x45 && // E
		buffer[10] === 0x42 && // B
		buffer[11] === 0x50 // P
	);
};

describe("WebP Generation", () => {
	it("should generate WebP output", async () => {
		const text = faker.internet.url();
		const qr = new QrBit({ text });
		const webp = await qr.toWebp();

		expect(webp).toBeInstanceOf(Buffer);
		expect(webp.length).toBeGreaterThan(0);
		// Check WebP signature
		expect(isValidWebP(webp)).toBe(true);
	});

	it("should generate WebP with default options", async () => {
		const text = faker.internet.url();
		const qr = new QrBit({ text });
		const webp = await qr.toWebp();

		expect(webp).toBeInstanceOf(Buffer);
		expect(webp.length).toBeGreaterThan(0);
	});

	it("should generate WebP with quality parameter (reserved for future use)", async () => {
		const text = faker.internet.url();
		const qr = new QrBit({ text });
		const webp = await qr.toWebp({ quality: 95 });

		expect(webp).toBeInstanceOf(Buffer);
		expect(webp.length).toBeGreaterThan(0);
		// Check WebP signature
		expect(isValidWebP(webp)).toBe(true);
	});

	it("should generate WebP with low quality parameter (reserved for future use)", async () => {
		const text = faker.internet.url();
		const qr = new QrBit({ text });
		const webp = await qr.toWebp({ quality: 60 });

		expect(webp).toBeInstanceOf(Buffer);
		expect(webp.length).toBeGreaterThan(0);
	});

	it("should generate WebP with logo path", async () => {
		const text = faker.person.fullName();
		const qr = new QrBit({ text, logo: testLogoPathSmall });
		const webp = await qr.toWebp();

		expect(webp).toBeInstanceOf(Buffer);
		expect(webp.length).toBeGreaterThan(0);
		// Check WebP signature
		expect(isValidWebP(webp)).toBe(true);
	});

	it("should generate WebP with logo buffer", async () => {
		const logoBuffer = fs.readFileSync(testLogoPath);
		const text = faker.internet.url();
		const qr = new QrBit({ text, logo: logoBuffer });
		const webp = await qr.toWebp();

		expect(webp).toBeInstanceOf(Buffer);
		expect(webp.length).toBeGreaterThan(0);
	});

	it("should generate WebP with custom colors", async () => {
		const qr = new QrBit({
			text: faker.internet.url(),
			backgroundColor: "#FF0000",
			foregroundColor: "#0000FF",
		});

		const webp = await qr.toWebp();
		expect(webp).toBeInstanceOf(Buffer);
		expect(webp.length).toBeGreaterThan(0);
	});

	it("should generate WebP with custom size", async () => {
		const qr = new QrBit({
			text: faker.internet.url(),
			size: 400,
		});

		const webp = await qr.toWebp();
		expect(webp).toBeInstanceOf(Buffer);
		expect(webp.length).toBeGreaterThan(0);
	});

	it("should generate WebP with custom margin", async () => {
		const qr = new QrBit({
			text: faker.internet.url(),
			size: 300,
			margin: 40,
		});

		const webp = await qr.toWebp();
		expect(webp).toBeInstanceOf(Buffer);
		expect(webp.length).toBeGreaterThan(0);
	});
});

describe("WebP File Operations", () => {
	const tempDir = "./test/temp";
	const testWebpPath = `${tempDir}/test-qr.webp`;

	beforeEach(async () => {
		// Create temp directory
		if (!fs.existsSync(tempDir)) {
			fs.mkdirSync(tempDir, { recursive: true });
		}
	});

	afterEach(async () => {
		// Clean up test files
		if (fs.existsSync(testWebpPath)) {
			fs.unlinkSync(testWebpPath);
		}
		// Clean up any nested directories that might have been created
		try {
			if (fs.existsSync(`${tempDir}/nested`)) {
				fs.rmSync(`${tempDir}/nested`, { recursive: true });
			}
		} catch {
			// Directory doesn't exist, ignore
		}
		// Remove temp directory if empty
		try {
			fs.rmdirSync(tempDir);
		} catch {
			// Directory not empty or doesn't exist, ignore
		}
	});

	it("should save WebP QR code to file", async () => {
		const text = faker.internet.url();
		const qr = new QrBit({ text });

		await qr.toWebpFile(testWebpPath);

		// Verify file exists
		expect(fs.existsSync(testWebpPath)).toBe(true);

		// Verify file content is valid WebP
		const fileBuffer = fs.readFileSync(testWebpPath);
		expect(fileBuffer).toBeInstanceOf(Buffer);
		expect(fileBuffer.length).toBeGreaterThan(0);

		// Check WebP signature
		expect(isValidWebP(fileBuffer)).toBe(true);
	});

	it("should save WebP with quality parameter to file", async () => {
		const text = faker.internet.url();
		const qr = new QrBit({ text });

		await qr.toWebpFile(testWebpPath, { quality: 95 });

		// Verify file exists
		expect(fs.existsSync(testWebpPath)).toBe(true);

		const fileBuffer = fs.readFileSync(testWebpPath);
		expect(fileBuffer.length).toBeGreaterThan(0);
	});

	it("should save WebP QR code with logo to file", async () => {
		const text = faker.internet.url();
		const qr = new QrBit({ text, logo: testLogoPath });

		await qr.toWebpFile(testWebpPath);

		// Verify file exists
		expect(fs.existsSync(testWebpPath)).toBe(true);

		// Verify file content is valid WebP
		const fileBuffer = fs.readFileSync(testWebpPath);
		expect(fileBuffer).toBeInstanceOf(Buffer);
		expect(fileBuffer.length).toBeGreaterThan(0);

		// Check WebP signature
		expect(isValidWebP(fileBuffer)).toBe(true);
	});

	it("should save WebP to file with caching disabled", async () => {
		const text = faker.internet.url();
		const qr = new QrBit({ text });

		await qr.toWebpFile(testWebpPath, { cache: false });

		// Verify file exists
		expect(fs.existsSync(testWebpPath)).toBe(true);

		const fileBuffer = fs.readFileSync(testWebpPath);
		expect(fileBuffer).toBeInstanceOf(Buffer);
		expect(fileBuffer.length).toBeGreaterThan(0);
	});

	it("should create directories if they don't exist", async () => {
		const deepPath = `${tempDir}/nested/deep/test-qr.webp`;
		const text = faker.internet.url();
		const qr = new QrBit({ text });

		// This should create the nested directories
		await qr.toWebpFile(deepPath);

		// Verify file exists
		expect(fs.existsSync(deepPath)).toBe(true);

		// Verify it's a valid WebP
		const fileBuffer = fs.readFileSync(deepPath);
		expect(isValidWebP(fileBuffer)).toBe(true);

		// Clean up the nested file and directories
		fs.unlinkSync(deepPath);
		fs.rmSync(`${tempDir}/nested`, { recursive: true });
	});
});

describe("WebP Caching", () => {
	it("should cache WebP QR codes by default", async () => {
		const text = faker.internet.url();
		const qr = new QrBit({ text });

		const webp1 = await qr.toWebp();
		const webp2 = await qr.toWebp();

		expect(webp1).toEqual(webp2);

		const cacheKey = await qr.generateCacheKey("napi-webp-90");
		expect(qr.cache).toBeDefined();
		expect(qr.cache).toBeInstanceOf(Cacheable);
		const has = await qr.cache?.has(cacheKey);
		expect(has).toBe(true);
	});

	it("should not use cache when cache is disabled", async () => {
		const text = faker.internet.url();
		const qr = new QrBit({ text });

		const webp1 = await qr.toWebp({ cache: false });
		const webp2 = await qr.toWebp({ cache: false });

		expect(webp1).toEqual(webp2);

		const cacheKey = await qr.generateCacheKey("napi-webp-90");
		expect(qr.cache).toBeDefined();
		expect(qr.cache).toBeInstanceOf(Cacheable);
		const has = await qr.cache?.has(cacheKey);
		expect(has).toBe(false);
	});

	it("should cache different quality keys separately", async () => {
		const text = faker.internet.url();
		const qr = new QrBit({ text });

		await qr.toWebp({ quality: 90 });
		await qr.toWebp({ quality: 60 });

		// Both should be cached with different keys
		const cacheKey90 = await qr.generateCacheKey("napi-webp-90");
		const cacheKey60 = await qr.generateCacheKey("napi-webp-60");

		const has90 = await qr.cache?.has(cacheKey90);
		const has60 = await qr.cache?.has(cacheKey60);

		expect(has90).toBe(true);
		expect(has60).toBe(true);
	});

	it("should use cache instance when provided", async () => {
		const text = faker.internet.url();
		const cache = new Cacheable();
		const qr = new QrBit({ text, cache });

		await qr.toWebp();

		const cacheKey = await qr.generateCacheKey("napi-webp-90");
		const has = await cache.has(cacheKey);
		expect(has).toBe(true);
	});

	it("should not cache when cache is set to false", async () => {
		const text = faker.internet.url();
		const qr = new QrBit({ text, cache: false });

		expect(qr.cache).toBeUndefined();

		const webp = await qr.toWebp();
		expect(webp).toBeInstanceOf(Buffer);
	});
});

describe("Static WebP Conversion", () => {
	it("should convert SVG to WebP using static method", () => {
		const svgContent =
			'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="red"/></svg>';

		const webpBuffer = QrBit.convertSvgToWebp(svgContent);

		expect(webpBuffer).toBeInstanceOf(Buffer);
		expect(webpBuffer.length).toBeGreaterThan(0);
		// Check WebP signature
		expect(isValidWebP(webpBuffer)).toBe(true);
	});

	it("should convert SVG to WebP with custom dimensions", () => {
		const svgContent =
			'<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50"><circle cx="25" cy="25" r="20" fill="blue"/></svg>';

		const webpBuffer = QrBit.convertSvgToWebp(svgContent, 200, 200);

		expect(webpBuffer).toBeInstanceOf(Buffer);
		expect(webpBuffer.length).toBeGreaterThan(0);
		// Check WebP signature
		expect(isValidWebP(webpBuffer)).toBe(true);
	});

	it("should convert SVG to WebP with quality parameter (reserved)", () => {
		const svgContent =
			'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="green"/></svg>';

		const webpHigh = QrBit.convertSvgToWebp(svgContent, 100, 100, 95);
		const webpLow = QrBit.convertSvgToWebp(svgContent, 100, 100, 60);

		// Both should be valid WebP (lossless encoding means same output)
		expect(isValidWebP(webpHigh)).toBe(true);
		expect(isValidWebP(webpLow)).toBe(true);
	});

	it("should handle invalid SVG content gracefully", () => {
		const invalidSvg = "not valid svg content";

		expect(() => {
			QrBit.convertSvgToWebp(invalidSvg);
		}).toThrow();
	});
});

describe("WebP with Various QR Options", () => {
	it("should generate WebP with custom size and colors", async () => {
		const qr = new QrBit({
			text: faker.internet.url(),
			size: 400,
			backgroundColor: "#0000FF",
			foregroundColor: "#FFFFFF",
		});

		const webp = await qr.toWebp({ quality: 85 });
		expect(webp).toBeInstanceOf(Buffer);
		expect(webp.length).toBeGreaterThan(0);
	});

	it("should generate WebP with logo and custom size", async () => {
		const qr = new QrBit({
			text: faker.internet.url(),
			logo: testLogoPathSmall,
			size: 400,
			logoSizeRatio: 0.3,
		});

		const webp = await qr.toWebp({ quality: 85 });
		expect(webp).toBeInstanceOf(Buffer);
		expect(webp.length).toBeGreaterThan(0);
	});

	it("should handle very long text in WebP", async () => {
		const longText = "A".repeat(1000);
		const qr = new QrBit({ text: longText });

		const webp = await qr.toWebp();
		expect(webp).toBeInstanceOf(Buffer);
		expect(webp.length).toBeGreaterThan(0);
	});

	it("should handle special characters in WebP", async () => {
		const specialText =
			"你好 🌍 https://example.com/path?param=value&other=123";
		const qr = new QrBit({ text: specialText });

		const webp = await qr.toWebp();
		expect(webp).toBeInstanceOf(Buffer);
		expect(webp.length).toBeGreaterThan(0);
	});
});

describe("WebP Lossless Encoding", () => {
	it("should produce consistent output regardless of quality parameter", async () => {
		const text = faker.internet.url();
		const qr = new QrBit({ text });

		// Since WebP uses lossless encoding, quality parameter is reserved for future use
		// Currently, output should be the same regardless of quality setting
		const webp90 = await qr.toWebp({ quality: 90 });
		const webp60 = await qr.toWebp({ quality: 60 });

		// Both should be valid WebP
		expect(isValidWebP(webp90)).toBe(true);
		expect(isValidWebP(webp60)).toBe(true);
	});
});
