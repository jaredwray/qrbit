import fs from "node:fs";
import { faker } from "@faker-js/faker";
import { Cacheable } from "cacheable";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { QrBit } from "../src/qrbit";

const testLogoPath = "test/fixtures/test_logo.png";
const testLogoPathSmall = "test/fixtures/test_logo_small.png";

describe("QrBit Class", () => {
	it("should create a QrBit instance with default options", () => {
		const text = faker.internet.url();
		const qr = new QrBit({ text });
		expect(qr).toBeInstanceOf(QrBit);
	});

	it("should generate SVG output", async () => {
		const text = faker.person.fullName();
		const qr = new QrBit({ text });
		const svg = await qr.toSvg();

		expect(typeof svg).toBe("string");
		expect(svg).toContain("<svg");
		expect(svg).toContain("</svg>");
		// SVG should not contain explicit width/height when margin is undefined
		expect(svg).toContain("viewBox=");
	});

	it("should generate SVG output with logo path", async () => {
		const text = faker.person.fullName();
		const qr = new QrBit({ text, logo: testLogoPathSmall });
		const svg = await qr.toSvg();

		expect(typeof svg).toBe("string");
		expect(svg).toContain("<svg");
		expect(svg).toContain("</svg>");
		expect(svg).toContain('width="240"');
		expect(svg).toContain('height="240"');
		expect(svg).toContain("data:image/png;base64,"); // Should contain base64 data URL
	});

	it("should generate PNG output", async () => {
		const text = faker.internet.url();
		const qr = new QrBit({ text });
		const png = await qr.toPng();

		expect(png).toBeInstanceOf(Buffer);
		expect(png.length).toBeGreaterThan(0);
		// Check PNG signature
		expect(png[0]).toBe(0x89);
		expect(png[1]).toBe(0x50);
		expect(png[2]).toBe(0x4e);
		expect(png[3]).toBe(0x47);
	});

	it("should support method chaining", async () => {
		const text = faker.internet.url();
		const qr = new QrBit({ text });
		qr.size = 300;
		qr.margin = 30;
		qr.backgroundColor = "#FF0000";
		qr.foregroundColor = "#00FF00";

		const result = await qr.toSvg();
		expect(result).toContain("<svg");
	});

	it("should accept custom colors", async () => {
		const qr = new QrBit({
			text: faker.internet.url(),
			backgroundColor: "#FF0000",
			foregroundColor: "#0000FF",
		});

		const svg = await qr.toSvg();
		expect(svg).toContain("#FF0000"); // red background
		expect(svg).toContain("#0000FF"); // blue foreground
	});
});

describe("QrBit Properties", () => {
	it("should get and set text property", () => {
		const text = faker.internet.url();
		const qr = new QrBit({ text });
		expect(qr.text).toBe(text);

		qr.text = "New Text";
		expect(qr.text).toBe("New Text");
	});

	it("should get and set size property", () => {
		const text = faker.internet.url();
		const qr = new QrBit({ text });
		expect(qr.size).toBe(200); // default value

		qr.size = 300;
		expect(qr.size).toBe(300);
	});

	it("should get and set margin property", () => {
		const text = faker.internet.url();
		const qr = new QrBit({ text });
		expect(qr.margin).toBeUndefined(); // default value

		qr.margin = 30;
		expect(qr.margin).toBe(30);
	});

	it("should get and set logoPath property", () => {
		const text = faker.internet.url();
		const qr = new QrBit({ text });
		expect(qr.logo).toBeUndefined(); // default value

		qr.logo = "path/to/logo.png";
		expect(qr.logo).toBe("path/to/logo.png");
	});

	it("should get and set logoSizeRatio property", () => {
		const text = faker.internet.url();
		const qr = new QrBit({ text });
		expect(qr.logoSizeRatio).toBe(0.2); // default value

		qr.logoSizeRatio = 0.5;
		expect(qr.logoSizeRatio).toBe(0.5);
	});

	it("should get and set backgroundColor property", () => {
		const text = faker.internet.url();
		const qr = new QrBit({ text });
		expect(qr.backgroundColor).toBe("#FFFFFF"); // default value

		qr.backgroundColor = "#FF0000";
		expect(qr.backgroundColor).toBe("#FF0000");
	});

	it("should get and set foregroundColor property", () => {
		const text = faker.internet.url();
		const qr = new QrBit({ text });
		expect(qr.foregroundColor).toBe("#000000"); // default value

		qr.foregroundColor = "#0000FF";
		expect(qr.foregroundColor).toBe("#0000FF");
	});

	it("should initialize with custom values", () => {
		const text = faker.string.alphanumeric(20);
		const qr = new QrBit({
			text,
			size: 150,
			margin: 10,
			logo: "logo.png",
			logoSizeRatio: 0.3,
			backgroundColor: "#FFFF00",
			foregroundColor: "#FF00FF",
		});

		expect(qr.text).toBe(text);
		expect(qr.size).toBe(150);
		expect(qr.margin).toBe(10);
		expect(qr.logo).toBe("logo.png");
		expect(qr.logoSizeRatio).toBe(0.3);
		expect(qr.backgroundColor).toBe("#FFFF00");
		expect(qr.foregroundColor).toBe("#FF00FF");
	});

	it("should use properties when generating QR code", async () => {
		const text = faker.internet.url();
		const qr = new QrBit({ text });
		qr.size = 100;
		qr.margin = 5;
		qr.backgroundColor = "#FF0000";
		qr.foregroundColor = "#0000FF";

		const svg = await qr.toSvg();

		expect(svg).toContain("#FF0000"); // red background
		expect(svg).toContain("#0000FF"); // blue foreground
	});
});

describe("Error Handling", () => {
	it("should handle invalid logo path gracefully", async () => {
		const text = faker.internet.url();
		const qr = new QrBit({
			text,
			logo: "/nonexistent/path/logo.png",
		});

		// Should throw an error when trying to generate
		await expect(qr.toSvg()).rejects.toThrow();
	});

	it("should handle invalid color formats", async () => {
		const text = faker.internet.url();
		const qr = new QrBit({
			text,
			backgroundColor: "invalid-color",
		});

		await expect(qr.toSvg()).rejects.toThrow();
	});

	it("should handle empty text", () => {
		expect(() => new QrBit({ text: "" })).not.toThrow();
	});

	it("should test setLogo with sizeRatio parameter", () => {
		const text = faker.internet.url();
		const qr = new QrBit({ text });
		qr.logo = "test.png";
		qr.logoSizeRatio = 0.5;
		expect(qr).toBeInstanceOf(QrBit);
		expect(qr.logoSizeRatio).toBe(0.5);
		expect(qr.logo).toBe("test.png");
	});

	it("should generate QR code with logo using testLogoPath", async () => {
		const qr = new QrBit({
			text: faker.internet.url(),
			logo: testLogoPath,
		});

		const result = await qr.toSvg();

		expect(result).toContain("<svg");
	});
});

describe("Edge Cases", () => {
	it("should handle very long text", async () => {
		const longText = "A".repeat(1000);
		const qr = new QrBit({ text: longText });

		const result = await qr.toSvg();
		expect(result).toContain("<svg");
	});

	it("should handle special characters", async () => {
		const specialText =
			"你好 🌍 https://example.com/path?param=value&other=123";
		const qr = new QrBit({ text: specialText });

		const svg = await qr.toSvg();
		expect(svg).toContain("<svg");
	});
});

describe("Caching", () => {
	it("should be able to set caching to false", async () => {
		const text = faker.internet.url();
		const qr = new QrBit({ text, cache: false });

		expect(qr.cache).toBeUndefined();
	});

	it("should be able to set caching to true", async () => {
		const text = faker.internet.url();
		const qr = new QrBit({ text, cache: true });

		expect(qr.cache).toBeDefined();
		expect(qr.cache).toBeInstanceOf(Cacheable);
	});

	it("should be able to set caching to Cacheable", async () => {
		const text = faker.internet.url();
		const cache = new Cacheable();
		const qr = new QrBit({ text, cache });

		expect(qr.cache).toBeDefined();
		expect(qr.cache).toBeInstanceOf(Cacheable);
		expect(qr.cache).toBe(cache);
	});

	it("should be able to set the cache property to Cacheable", async () => {
		const text = faker.internet.url();
		const cache = new Cacheable();
		const qr = new QrBit({ text, cache: false });
		expect(qr.cache).toBeUndefined();

		qr.cache = cache;

		expect(qr.cache).toBeDefined();
		expect(qr.cache).toBeInstanceOf(Cacheable);
		expect(qr.cache).toBe(cache);
	});

	it("should cache svg QR codes by default", async () => {
		const text = faker.internet.url();
		const qr = new QrBit({ text });

		const result1 = await qr.toSvg();
		const result2 = await qr.toSvg();

		expect(result1).toEqual(result2);

		const cacheKey = await qr.generateCacheKey(`native-svg`);
		expect(qr.cache).toBeDefined();
		expect(qr.cache).toBeInstanceOf(Cacheable);
		const has = await qr.cache?.has(cacheKey);
		expect(has).toBe(true);
	});

	it("should not use cache on svg when useCache is false", async () => {
		const text = faker.internet.url();
		const qr = new QrBit({ text });

		const result1 = await qr.toSvg({ cache: false });
		const result2 = await qr.toSvg({ cache: false });

		expect(result1).toEqual(result2);

		const cacheKey = await qr.generateCacheKey(`native-svg`);
		expect(qr.cache).toBeDefined();
		expect(qr.cache).toBeInstanceOf(Cacheable);
		const has = await qr.cache?.has(cacheKey);
		expect(has).toBe(false);
	});

	it("should cache png QR codes by default", async () => {
		const text = faker.internet.url();
		const qr = new QrBit({ text });

		const result1 = await qr.toPng();
		const result2 = await qr.toPng();

		expect(result1).toEqual(result2);

		const cacheKey = await qr.generateCacheKey(`napi-png`);
		expect(qr.cache).toBeDefined();
		expect(qr.cache).toBeInstanceOf(Cacheable);
		const has = await qr.cache?.has(cacheKey);
		expect(has).toBe(true);
	});

	it("should not use cache on png when useCache is false", async () => {
		const text = faker.internet.url();
		const qr = new QrBit({ text });

		const result1 = await qr.toPng({ cache: false });
		const result2 = await qr.toPng({ cache: false });

		expect(result1).toEqual(result2);

		const cacheKey = await qr.generateCacheKey(`napi-png`);
		expect(qr.cache).toBeDefined();
		expect(qr.cache).toBeInstanceOf(Cacheable);
		const has = await qr.cache?.has(cacheKey);
		expect(has).toBe(false);
	});
});

describe("Buffer Logo", () => {
	it("should generate SVG QR code with logo from buffer", async () => {
		const logoBuffer = fs.readFileSync(testLogoPath);
		const text = faker.internet.url();

		// Import the native function directly
		const qr = new QrBit({ text, logo: logoBuffer });

		const svg = await qr.toSvgNapi();

		expect(typeof svg).toBe("string");
		expect(svg).toContain("<svg");
		expect(svg).toContain("</svg>");
		expect(svg).toContain("data:image/png;base64,"); // Should contain base64 data URL
	});
});

describe("File Operations", () => {
	const tempDir = "./test/temp";
	const testPngPath = `${tempDir}/test-qr.png`;
	const testSvgPath = `${tempDir}/test-qr.svg`;

	beforeEach(async () => {
		// Create temp directory
		if (!fs.existsSync(tempDir)) {
			fs.mkdirSync(tempDir, { recursive: true });
		}
	});

	afterEach(async () => {
		// Clean up test files
		if (fs.existsSync(testPngPath)) {
			fs.unlinkSync(testPngPath);
		}
		if (fs.existsSync(testSvgPath)) {
			fs.unlinkSync(testSvgPath);
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

	it("should save PNG QR code to file", async () => {
		const text = faker.internet.url();
		const qr = new QrBit({ text });

		await qr.toPngFile(testPngPath);

		// Verify file exists
		expect(fs.existsSync(testPngPath)).toBe(true);

		// Verify file content is valid PNG
		const fileBuffer = fs.readFileSync(testPngPath);
		expect(fileBuffer).toBeInstanceOf(Buffer);
		expect(fileBuffer.length).toBeGreaterThan(0);

		// Check PNG signature
		expect(fileBuffer[0]).toBe(0x89);
		expect(fileBuffer[1]).toBe(0x50);
		expect(fileBuffer[2]).toBe(0x4e);
		expect(fileBuffer[3]).toBe(0x47);
	});

	it("should save PNG QR code with logo to file", async () => {
		const text = faker.internet.url();
		const qr = new QrBit({ text, logo: testLogoPath });

		await qr.toPngFile(testPngPath);

		// Verify file exists
		expect(fs.existsSync(testPngPath)).toBe(true);

		// Verify file content is valid PNG
		const fileBuffer = fs.readFileSync(testPngPath);
		expect(fileBuffer).toBeInstanceOf(Buffer);
		expect(fileBuffer.length).toBeGreaterThan(0);

		// Check PNG signature
		expect(fileBuffer[0]).toBe(0x89);
		expect(fileBuffer[1]).toBe(0x50);
		expect(fileBuffer[2]).toBe(0x4e);
		expect(fileBuffer[3]).toBe(0x47);
	});

	it("should save PNG QR code to file with caching disabled", async () => {
		const text = faker.internet.url();
		const qr = new QrBit({ text });

		await qr.toPngFile(testPngPath, { cache: false });

		// Verify file exists
		expect(fs.existsSync(testPngPath)).toBe(true);

		// Verify file content is valid PNG
		const fileBuffer = fs.readFileSync(testPngPath);
		expect(fileBuffer).toBeInstanceOf(Buffer);
		expect(fileBuffer.length).toBeGreaterThan(0);
	});

	it("should create directories if they don't exist", async () => {
		const deepPath = `${tempDir}/nested/deep/test-qr.png`;
		const text = faker.internet.url();
		const qr = new QrBit({ text });

		// This should create the nested directories
		await qr.toPngFile(deepPath);

		// Verify file exists
		expect(fs.existsSync(deepPath)).toBe(true);

		// Clean up the nested file and directories
		fs.unlinkSync(deepPath);
		fs.rmSync(`${tempDir}/nested`, { recursive: true });
	});

	it("should save SVG QR code to file", async () => {
		const text = faker.internet.url();
		const qr = new QrBit({ text });

		await qr.toSvgFile(testSvgPath);

		// Verify file exists
		expect(fs.existsSync(testSvgPath)).toBe(true);

		// Verify file content is valid SVG
		const fileContent = fs.readFileSync(testSvgPath, "utf8");
		expect(typeof fileContent).toBe("string");
		expect(fileContent.length).toBeGreaterThan(0);

		// Check SVG structure
		expect(fileContent).toContain("<svg");
		expect(fileContent).toContain("</svg>");
		// SVG should not contain explicit width/height when margin is undefined
		expect(fileContent).toContain("viewBox=");
	});

	it("should save SVG QR code with logo to file", async () => {
		const text = faker.internet.url();
		const qr = new QrBit({ text, logo: testLogoPath });

		await qr.toSvgFile(testSvgPath);

		// Verify file exists
		expect(fs.existsSync(testSvgPath)).toBe(true);

		// Verify file content is valid SVG
		const fileContent = fs.readFileSync(testSvgPath, "utf8");
		expect(typeof fileContent).toBe("string");
		expect(fileContent.length).toBeGreaterThan(0);

		// Check SVG structure and logo embedding
		expect(fileContent).toContain("<svg");
		expect(fileContent).toContain("</svg>");
		expect(fileContent).toContain('width="240"');
		expect(fileContent).toContain('height="240"');
		expect(fileContent).toContain("data:image/png;base64,"); // Should contain base64 data URL
	});

	it("should save SVG QR code to file with caching disabled", async () => {
		const text = faker.internet.url();
		const qr = new QrBit({ text });

		await qr.toSvgFile(testSvgPath, { cache: false });

		// Verify file exists
		expect(fs.existsSync(testSvgPath)).toBe(true);

		// Verify file content is valid SVG
		const fileContent = fs.readFileSync(testSvgPath, "utf8");
		expect(typeof fileContent).toBe("string");
		expect(fileContent.length).toBeGreaterThan(0);
		expect(fileContent).toContain("<svg");
		expect(fileContent).toContain("</svg>");
	});

	it("should create directories for SVG files if they don't exist", async () => {
		const deepSvgPath = `${tempDir}/nested/deep/test-qr.svg`;
		const text = faker.internet.url();
		const qr = new QrBit({ text });

		// This should create the nested directories
		await qr.toSvgFile(deepSvgPath);

		// Verify file exists
		expect(fs.existsSync(deepSvgPath)).toBe(true);

		// Verify file content
		const fileContent = fs.readFileSync(deepSvgPath, "utf8");
		expect(fileContent).toContain("<svg");
		expect(fileContent).toContain("</svg>");

		// Clean up the nested file (cleanup will handle directories)
		fs.unlinkSync(deepSvgPath);
	});
});

describe("Logo File Validation", () => {
	const tempDir = "./test/temp";
	const existingFile = `${tempDir}/existing.txt`;
	const nonExistentFile = `${tempDir}/does-not-exist.txt`;

	beforeEach(async () => {
		// Create temp directory and test file
		if (!fs.existsSync(tempDir)) {
			fs.mkdirSync(tempDir, { recursive: true });
		}
		fs.writeFileSync(existingFile, "test content");
	});

	afterEach(async () => {
		// Clean up test files
		if (fs.existsSync(existingFile)) {
			fs.unlinkSync(existingFile);
		}
		// Remove temp directory if empty
		try {
			fs.rmdirSync(tempDir);
		} catch {
			// Directory not empty or doesn't exist, ignore
		}
	});

	it("should return true for existing file", async () => {
		const text = faker.internet.url();
		const qr = new QrBit({ text });

		const exists = await qr.logoFileExists(existingFile);
		expect(exists).toBe(true);
	});

	it("should return false for non-existent file", async () => {
		const text = faker.internet.url();
		const qr = new QrBit({ text });

		const exists = await qr.logoFileExists(nonExistentFile);
		expect(exists).toBe(false);
	});

	it("should return false for empty path", async () => {
		const text = faker.internet.url();
		const qr = new QrBit({ text });

		const exists = await qr.logoFileExists("");
		expect(exists).toBe(false);
	});

	it("should validate logo files", async () => {
		const text = faker.internet.url();
		const qr = new QrBit({ text });

		// Should return true for test logo file
		const logoExists = await qr.logoFileExists(testLogoPath);
		expect(logoExists).toBe(true);

		// Should return false for non-existent logo
		const nonExistentLogoExists = await qr.logoFileExists(
			"/non/existent/logo.png",
		);
		expect(nonExistentLogoExists).toBe(false);
	});
});

describe("Logo File Validation in Methods", () => {
	it("should emit error when logo file does not exist in toSvgNapi", async () => {
		const text = faker.internet.url();
		const qr = new QrBit({ text, logo: "/non/existent/logo.png" });

		let errorEmitted = false;
		let errorMessage = "";

		// Listen for error event
		qr.on("error", (message: string) => {
			errorEmitted = true;
			errorMessage = message;
		});

		// Should still generate SVG but emit error
		const svg = await qr.toSvgNapi();

		expect(errorEmitted).toBe(true);
		expect(errorMessage).toBe(
			"Logo file not found: /non/existent/logo.png. Proceeding without logo.",
		);
		expect(typeof svg).toBe("string");
		expect(svg).toContain("<svg");
	});

	it("should not emit error when logo file exists", async () => {
		const text = faker.internet.url();
		const qr = new QrBit({ text, logo: testLogoPath });

		let errorEmitted = false;

		// Listen for error event
		qr.on("error", () => {
			errorEmitted = true;
		});

		// Should generate without error
		await qr.toSvgNapi();

		expect(errorEmitted).toBe(false);
	});
});

describe("SVG to PNG Conversion", () => {
	it("should convert SVG content to PNG buffer using static method", () => {
		const svgContent =
			'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="red"/></svg>';

		const pngBuffer = QrBit.convertSvgToPng(svgContent);

		expect(pngBuffer).toBeInstanceOf(Buffer);
		expect(pngBuffer.length).toBeGreaterThan(0);
		// Check PNG signature
		expect(pngBuffer[0]).toBe(0x89);
		expect(pngBuffer[1]).toBe(0x50);
		expect(pngBuffer[2]).toBe(0x4e);
		expect(pngBuffer[3]).toBe(0x47);
	});

	it("should convert SVG to PNG with custom dimensions", () => {
		const svgContent =
			'<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50"><circle cx="25" cy="25" r="20" fill="blue"/></svg>';

		const pngBuffer = QrBit.convertSvgToPng(svgContent, 200, 200);

		expect(pngBuffer).toBeInstanceOf(Buffer);
		expect(pngBuffer.length).toBeGreaterThan(0);
		// Check PNG signature
		expect(pngBuffer[0]).toBe(0x89);
		expect(pngBuffer[1]).toBe(0x50);
		expect(pngBuffer[2]).toBe(0x4e);
		expect(pngBuffer[3]).toBe(0x47);
	});

	it("should convert QR code SVG to PNG using instance method", async () => {
		const text = faker.internet.url();
		const qr = new QrBit({ text, size: 150, margin: 10 });

		const pngBuffer = await qr.toPng();

		expect(pngBuffer).toBeInstanceOf(Buffer);
		expect(pngBuffer.length).toBeGreaterThan(0);
		// Check PNG signature
		expect(pngBuffer[0]).toBe(0x89);
		expect(pngBuffer[1]).toBe(0x50);
		expect(pngBuffer[2]).toBe(0x4e);
		expect(pngBuffer[3]).toBe(0x47);
	});

	it("should handle invalid SVG content gracefully", () => {
		const invalidSvg = "not valid svg content";

		expect(() => {
			QrBit.convertSvgToPng(invalidSvg);
		}).toThrow();
	});
});
