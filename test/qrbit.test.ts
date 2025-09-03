import fs from "node:fs";
import { faker } from "@faker-js/faker";
import { Cacheable } from "cacheable";
import { describe, expect, it } from "vitest";
import { QrBit } from "../src/qrbit";

const testLogoPath = "test/fixtures/test_logo.png";

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
		expect(svg).toContain('width="200"');
		expect(svg).toContain('height="200"');
	});

	it("should generate SVG output", async () => {
		const text = faker.person.fullName();
		const qr = new QrBit({ text, logo: testLogoPath });
		const svg = await qr.toSvg();

		expect(typeof svg).toBe("string");
		expect(svg).toContain("<svg");
		expect(svg).toContain("</svg>");
		expect(svg).toContain('width="240"');
		expect(svg).toContain('height="240"');
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

	it("should generate both SVG and PNG with generate()", async () => {
		const text = faker.lorem.paragraph();
		const qr = new QrBit({ text });
		const result = await qr.generate();

		expect(result).toHaveProperty("svg");
		expect(result).toHaveProperty("png");
		expect(result).toHaveProperty("width");
		expect(result).toHaveProperty("height");

		expect(typeof result.svg).toBe("string");
		expect(result.png).toBeInstanceOf(Buffer);
		expect(result.width).toBe(240);
		expect(result.height).toBe(240);
	});

	it("should support method chaining", async () => {
		const text = faker.internet.url();
		const qr = new QrBit({ text });
		qr.size = 300;
		qr.margin = 30;
		qr.backgroundColor = "#FF0000";
		qr.foregroundColor = "#00FF00";

		const result = await qr.generate();
		expect(result.width).toBe(360); // 300 + 2*30
		expect(result.height).toBe(360);
	});

	it("should accept custom size and margin", async () => {
		const qr = new QrBit({
			text: faker.internet.url(),
			size: 150,
			margin: 10,
		});

		const result = await qr.generate();
		expect(result.width).toBe(170); // 150 + 2*10
		expect(result.height).toBe(170);
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
		expect(qr.margin).toBe(20); // default value

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
		await expect(qr.generate()).rejects.toThrow();
	});

	it("should handle invalid color formats", async () => {
		const text = faker.internet.url();
		const qr = new QrBit({
			text,
			backgroundColor: "invalid-color",
		});

		await expect(qr.generate()).rejects.toThrow();
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
		console.log("Using logo path:", testLogoPath);
		const qr = new QrBit({
			text: faker.internet.url(),
			logo: testLogoPath,
		});

		const result = await qr.generate();

		expect(result).toHaveProperty("svg");
		expect(result).toHaveProperty("png");
		expect(result.svg).toContain("<svg");
		expect(result.png).toBeInstanceOf(Buffer);
		expect(result.png?.length).toBeGreaterThan(0);
	});
});

describe("Edge Cases", () => {
	it("should handle very long text", async () => {
		const longText = "A".repeat(1000);
		const qr = new QrBit({ text: longText });

		const result = await qr.generate();
		expect(result.svg).toContain("<svg");
		expect(result.png).toBeInstanceOf(Buffer);
	});

	it("should handle special characters", async () => {
		const specialText =
			"你好 🌍 https://example.com/path?param=value&other=123";
		const qr = new QrBit({ text: specialText });

		const result = await qr.generate();
		expect(result.svg).toContain("<svg");
		expect(result.png).toBeInstanceOf(Buffer);
	});

	it("should handle minimum size", async () => {
		const qr = new QrBit({
			text: "Hi",
			size: 50,
			margin: 0,
		});

		const result = await qr.generate();
		expect(result.width).toBe(50);
		expect(result.height).toBe(50);
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

		const cacheKey = qr.generateCacheKey();
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

		const cacheKey = qr.generateCacheKey();
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

		const cacheKey = qr.generateCacheKey();
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

		const cacheKey = qr.generateCacheKey();
		expect(qr.cache).toBeDefined();
		expect(qr.cache).toBeInstanceOf(Cacheable);
		const has = await qr.cache?.has(cacheKey);
		expect(has).toBe(false);
	});
});

describe("Buffer Logo Support", () => {
	it("should generate SVG QR code with logo from buffer", async () => {
		const logoBuffer = fs.readFileSync(testLogoPath);
		const text = faker.internet.url();

		// Import the native function directly
		const { generateQrSvgWithBuffer } = await import("../src/native.js");

		const svg = generateQrSvgWithBuffer({
			text,
			size: 200,
			margin: 20,
			logoBuffer,
			logoSizeRatio: 0.2,
			backgroundColor: "#FFFFFF",
			foregroundColor: "#000000",
		});

		expect(typeof svg).toBe("string");
		expect(svg).toContain("<svg");
		expect(svg).toContain("</svg>");
		expect(svg).toContain("data:image/png;base64,"); // Should contain base64 data URL
	});
});
