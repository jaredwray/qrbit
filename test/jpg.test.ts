import fs from "node:fs";
import { faker } from "@faker-js/faker";
import { Cacheable } from "cacheable";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { QrBit } from "../src/qrbit";

const testLogoPath = "test/fixtures/test_logo.png";
const testLogoPathSmall = "test/fixtures/test_logo_small.png";

describe("JPEG Generation", () => {
	it("should generate JPEG output", async () => {
		const text = faker.internet.url();
		const qr = new QrBit({ text });
		const jpg = await qr.toJpg();

		expect(jpg).toBeInstanceOf(Buffer);
		expect(jpg.length).toBeGreaterThan(0);
		// Check JPEG signature (0xFF, 0xD8, 0xFF)
		expect(jpg[0]).toBe(0xff);
		expect(jpg[1]).toBe(0xd8);
		expect(jpg[2]).toBe(0xff);
	});

	it("should generate JPEG with default quality", async () => {
		const text = faker.internet.url();
		const qr = new QrBit({ text });
		const jpg = await qr.toJpg();

		expect(jpg).toBeInstanceOf(Buffer);
		expect(jpg.length).toBeGreaterThan(0);
	});

	it("should generate JPEG with high quality", async () => {
		const text = faker.internet.url();
		const qr = new QrBit({ text });
		const jpg = await qr.toJpg({ quality: 95 });

		expect(jpg).toBeInstanceOf(Buffer);
		expect(jpg.length).toBeGreaterThan(0);
		// Check JPEG signature
		expect(jpg[0]).toBe(0xff);
		expect(jpg[1]).toBe(0xd8);
	});

	it("should generate JPEG with low quality", async () => {
		const text = faker.internet.url();
		const qr = new QrBit({ text });
		const jpg = await qr.toJpg({ quality: 60 });

		expect(jpg).toBeInstanceOf(Buffer);
		expect(jpg.length).toBeGreaterThan(0);
	});

	it("should generate different sizes based on quality", async () => {
		const text = faker.internet.url();
		const qr = new QrBit({ text });

		const jpgHigh = await qr.toJpg({ quality: 95 });
		const jpgLow = await qr.toJpg({ quality: 60 });

		// Higher quality should generally produce larger files
		expect(jpgHigh.length).toBeGreaterThan(jpgLow.length);
	});

	it("should generate JPEG with logo path", async () => {
		const text = faker.person.fullName();
		const qr = new QrBit({ text, logo: testLogoPathSmall });
		const jpg = await qr.toJpg();

		expect(jpg).toBeInstanceOf(Buffer);
		expect(jpg.length).toBeGreaterThan(0);
		// Check JPEG signature
		expect(jpg[0]).toBe(0xff);
		expect(jpg[1]).toBe(0xd8);
	});

	it("should generate JPEG with logo buffer", async () => {
		const logoBuffer = fs.readFileSync(testLogoPath);
		const text = faker.internet.url();
		const qr = new QrBit({ text, logo: logoBuffer });
		const jpg = await qr.toJpg();

		expect(jpg).toBeInstanceOf(Buffer);
		expect(jpg.length).toBeGreaterThan(0);
	});

	it("should generate JPEG with custom colors", async () => {
		const qr = new QrBit({
			text: faker.internet.url(),
			backgroundColor: "#FF0000",
			foregroundColor: "#0000FF",
		});

		const jpg = await qr.toJpg();
		expect(jpg).toBeInstanceOf(Buffer);
		expect(jpg.length).toBeGreaterThan(0);
	});

	it("should generate JPEG with custom size", async () => {
		const qr = new QrBit({
			text: faker.internet.url(),
			size: 400,
		});

		const jpg = await qr.toJpg();
		expect(jpg).toBeInstanceOf(Buffer);
		expect(jpg.length).toBeGreaterThan(0);
	});

	it("should generate JPEG with custom margin", async () => {
		const qr = new QrBit({
			text: faker.internet.url(),
			size: 300,
			margin: 40,
		});

		const jpg = await qr.toJpg();
		expect(jpg).toBeInstanceOf(Buffer);
		expect(jpg.length).toBeGreaterThan(0);
	});
});

describe("JPEG File Operations", () => {
	const tempDir = "./test/temp";
	const testJpgPath = `${tempDir}/test-qr.jpg`;

	beforeEach(async () => {
		// Create temp directory
		if (!fs.existsSync(tempDir)) {
			fs.mkdirSync(tempDir, { recursive: true });
		}
	});

	afterEach(async () => {
		// Clean up test files
		if (fs.existsSync(testJpgPath)) {
			fs.unlinkSync(testJpgPath);
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

	it("should save JPEG QR code to file", async () => {
		const text = faker.internet.url();
		const qr = new QrBit({ text });

		await qr.toJpgFile(testJpgPath);

		// Verify file exists
		expect(fs.existsSync(testJpgPath)).toBe(true);

		// Verify file content is valid JPEG
		const fileBuffer = fs.readFileSync(testJpgPath);
		expect(fileBuffer).toBeInstanceOf(Buffer);
		expect(fileBuffer.length).toBeGreaterThan(0);

		// Check JPEG signature
		expect(fileBuffer[0]).toBe(0xff);
		expect(fileBuffer[1]).toBe(0xd8);
		expect(fileBuffer[2]).toBe(0xff);
	});

	it("should save JPEG with custom quality to file", async () => {
		const text = faker.internet.url();
		const qr = new QrBit({ text });

		await qr.toJpgFile(testJpgPath, { quality: 95 });

		// Verify file exists
		expect(fs.existsSync(testJpgPath)).toBe(true);

		const fileBuffer = fs.readFileSync(testJpgPath);
		expect(fileBuffer.length).toBeGreaterThan(0);
	});

	it("should save JPEG QR code with logo to file", async () => {
		const text = faker.internet.url();
		const qr = new QrBit({ text, logo: testLogoPath });

		await qr.toJpgFile(testJpgPath);

		// Verify file exists
		expect(fs.existsSync(testJpgPath)).toBe(true);

		// Verify file content is valid JPEG
		const fileBuffer = fs.readFileSync(testJpgPath);
		expect(fileBuffer).toBeInstanceOf(Buffer);
		expect(fileBuffer.length).toBeGreaterThan(0);

		// Check JPEG signature
		expect(fileBuffer[0]).toBe(0xff);
		expect(fileBuffer[1]).toBe(0xd8);
	});

	it("should save JPEG to file with caching disabled", async () => {
		const text = faker.internet.url();
		const qr = new QrBit({ text });

		await qr.toJpgFile(testJpgPath, { cache: false });

		// Verify file exists
		expect(fs.existsSync(testJpgPath)).toBe(true);

		const fileBuffer = fs.readFileSync(testJpgPath);
		expect(fileBuffer).toBeInstanceOf(Buffer);
		expect(fileBuffer.length).toBeGreaterThan(0);
	});

	it("should create directories if they don't exist", async () => {
		const deepPath = `${tempDir}/nested/deep/test-qr.jpg`;
		const text = faker.internet.url();
		const qr = new QrBit({ text });

		// This should create the nested directories
		await qr.toJpgFile(deepPath);

		// Verify file exists
		expect(fs.existsSync(deepPath)).toBe(true);

		// Verify it's a valid JPEG
		const fileBuffer = fs.readFileSync(deepPath);
		expect(fileBuffer[0]).toBe(0xff);
		expect(fileBuffer[1]).toBe(0xd8);

		// Clean up the nested file and directories
		fs.unlinkSync(deepPath);
		fs.rmSync(`${tempDir}/nested`, { recursive: true });
	});

	it("should save JPEG with different qualities", async () => {
		const text = faker.internet.url();
		const qr = new QrBit({ text });

		const highQualityPath = `${tempDir}/high-quality.jpg`;
		const lowQualityPath = `${tempDir}/low-quality.jpg`;

		await qr.toJpgFile(highQualityPath, { quality: 95 });
		await qr.toJpgFile(lowQualityPath, { quality: 60 });

		const highQualityBuffer = fs.readFileSync(highQualityPath);
		const lowQualityBuffer = fs.readFileSync(lowQualityPath);

		// Higher quality should produce larger files
		expect(highQualityBuffer.length).toBeGreaterThan(lowQualityBuffer.length);

		// Clean up
		fs.unlinkSync(highQualityPath);
		fs.unlinkSync(lowQualityPath);
	});
});

describe("JPEG Caching", () => {
	it("should cache JPEG QR codes by default", async () => {
		const text = faker.internet.url();
		const qr = new QrBit({ text });

		const jpg1 = await qr.toJpg();
		const jpg2 = await qr.toJpg();

		expect(jpg1).toEqual(jpg2);

		const cacheKey = qr.generateCacheKey("napi-jpeg-90");
		expect(qr.cache).toBeDefined();
		expect(qr.cache).toBeInstanceOf(Cacheable);
		const has = await qr.cache?.has(cacheKey);
		expect(has).toBe(true);
	});

	it("should not use cache when cache is disabled", async () => {
		const text = faker.internet.url();
		const qr = new QrBit({ text });

		const jpg1 = await qr.toJpg({ cache: false });
		const jpg2 = await qr.toJpg({ cache: false });

		expect(jpg1).toEqual(jpg2);

		const cacheKey = qr.generateCacheKey("napi-jpeg-90");
		expect(qr.cache).toBeDefined();
		expect(qr.cache).toBeInstanceOf(Cacheable);
		const has = await qr.cache?.has(cacheKey);
		expect(has).toBe(false);
	});

	it("should cache different qualities separately", async () => {
		const text = faker.internet.url();
		const qr = new QrBit({ text });

		const jpg90 = await qr.toJpg({ quality: 90 });
		const jpg60 = await qr.toJpg({ quality: 60 });

		// Both should be cached with different keys
		const cacheKey90 = qr.generateCacheKey("napi-jpeg-90");
		const cacheKey60 = qr.generateCacheKey("napi-jpeg-60");

		const has90 = await qr.cache?.has(cacheKey90);
		const has60 = await qr.cache?.has(cacheKey60);

		expect(has90).toBe(true);
		expect(has60).toBe(true);

		// They should be different
		expect(jpg90.length).not.toBe(jpg60.length);
	});

	it("should use cache instance when provided", async () => {
		const text = faker.internet.url();
		const cache = new Cacheable();
		const qr = new QrBit({ text, cache });

		await qr.toJpg();

		const cacheKey = qr.generateCacheKey("napi-jpeg-90");
		const has = await cache.has(cacheKey);
		expect(has).toBe(true);
	});

	it("should not cache when cache is set to false", async () => {
		const text = faker.internet.url();
		const qr = new QrBit({ text, cache: false });

		expect(qr.cache).toBeUndefined();

		const jpg = await qr.toJpg();
		expect(jpg).toBeInstanceOf(Buffer);
	});
});

describe("Static JPEG Conversion", () => {
	it("should convert SVG to JPEG using static method", () => {
		const svgContent =
			'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="red"/></svg>';

		const jpgBuffer = QrBit.convertSvgToJpeg(svgContent);

		expect(jpgBuffer).toBeInstanceOf(Buffer);
		expect(jpgBuffer.length).toBeGreaterThan(0);
		// Check JPEG signature
		expect(jpgBuffer[0]).toBe(0xff);
		expect(jpgBuffer[1]).toBe(0xd8);
		expect(jpgBuffer[2]).toBe(0xff);
	});

	it("should convert SVG to JPEG with custom dimensions", () => {
		const svgContent =
			'<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50"><circle cx="25" cy="25" r="20" fill="blue"/></svg>';

		const jpgBuffer = QrBit.convertSvgToJpeg(svgContent, 200, 200);

		expect(jpgBuffer).toBeInstanceOf(Buffer);
		expect(jpgBuffer.length).toBeGreaterThan(0);
		// Check JPEG signature
		expect(jpgBuffer[0]).toBe(0xff);
		expect(jpgBuffer[1]).toBe(0xd8);
	});

	it("should convert SVG to JPEG with custom quality", () => {
		const svgContent =
			'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="green"/></svg>';

		const jpgHigh = QrBit.convertSvgToJpeg(svgContent, 100, 100, 95);
		const jpgLow = QrBit.convertSvgToJpeg(svgContent, 100, 100, 60);

		expect(jpgHigh.length).toBeGreaterThan(jpgLow.length);
	});

	it("should handle invalid SVG content gracefully", () => {
		const invalidSvg = "not valid svg content";

		expect(() => {
			QrBit.convertSvgToJpeg(invalidSvg);
		}).toThrow();
	});
});

describe("JPEG Quality Parameters", () => {
	it("should accept quality values from 1 to 100", async () => {
		const text = faker.internet.url();
		const qr = new QrBit({ text });

		// Test boundary values
		const jpg1 = await qr.toJpg({ quality: 1 });
		const jpg100 = await qr.toJpg({ quality: 100 });

		expect(jpg1).toBeInstanceOf(Buffer);
		expect(jpg100).toBeInstanceOf(Buffer);
		expect(jpg100.length).toBeGreaterThan(jpg1.length);
	});

	it("should use default quality when not specified", async () => {
		const text = faker.internet.url();
		const qr = new QrBit({ text });

		const jpgDefault = await qr.toJpg();
		const jpg90 = await qr.toJpg({ quality: 90 });

		// Default quality is 90, so they should be the same
		expect(jpgDefault).toEqual(jpg90);
	});

	it("should generate progressively larger files with higher quality", async () => {
		const text = faker.internet.url();
		const qr = new QrBit({ text });

		const jpg60 = await qr.toJpg({ quality: 60 });
		const jpg70 = await qr.toJpg({ quality: 70 });
		const jpg80 = await qr.toJpg({ quality: 80 });
		const jpg90 = await qr.toJpg({ quality: 90 });

		expect(jpg70.length).toBeGreaterThanOrEqual(jpg60.length);
		expect(jpg80.length).toBeGreaterThanOrEqual(jpg70.length);
		expect(jpg90.length).toBeGreaterThanOrEqual(jpg80.length);
	});
});

describe("JPEG with Various QR Options", () => {
	it("should generate JPEG with custom size and colors", async () => {
		const qr = new QrBit({
			text: faker.internet.url(),
			size: 400,
			backgroundColor: "#0000FF",
			foregroundColor: "#FFFFFF",
		});

		const jpg = await qr.toJpg({ quality: 85 });
		expect(jpg).toBeInstanceOf(Buffer);
		expect(jpg.length).toBeGreaterThan(0);
	});

	it("should generate JPEG with logo and custom size", async () => {
		const qr = new QrBit({
			text: faker.internet.url(),
			logo: testLogoPathSmall,
			size: 400,
			logoSizeRatio: 0.3,
		});

		const jpg = await qr.toJpg({ quality: 85 });
		expect(jpg).toBeInstanceOf(Buffer);
		expect(jpg.length).toBeGreaterThan(0);
	});

	it("should handle very long text in JPEG", async () => {
		const longText = "A".repeat(1000);
		const qr = new QrBit({ text: longText });

		const jpg = await qr.toJpg();
		expect(jpg).toBeInstanceOf(Buffer);
		expect(jpg.length).toBeGreaterThan(0);
	});

	it("should handle special characters in JPEG", async () => {
		const specialText =
			"你好 🌍 https://example.com/path?param=value&other=123";
		const qr = new QrBit({ text: specialText });

		const jpg = await qr.toJpg();
		expect(jpg).toBeInstanceOf(Buffer);
		expect(jpg.length).toBeGreaterThan(0);
	});
});
