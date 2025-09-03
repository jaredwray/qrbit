import { describe, expect, it } from "vitest";
import { QrBit } from "../src/qrbit";

const testLogoPath = "test/fixtures/test_logo.png";

describe("QrBit Class", () => {
	it("should create a QrBit instance with default options", () => {
		const qr = new QrBit({ text: "Hello World" });
		expect(qr).toBeInstanceOf(QrBit);
	});

	it("should generate SVG output", () => {
		const qr = new QrBit({ text: "Hello World" });
		const svg = qr.generateSvg();

		expect(typeof svg).toBe("string");
		expect(svg).toContain("<svg");
		expect(svg).toContain("</svg>");
		expect(svg).toContain('width="240"'); // 200 + 2*20 margin
		expect(svg).toContain('height="240"');
	});

	it("should generate PNG output", () => {
		const qr = new QrBit({ text: "Hello World" });
		const png = qr.generatePng();

		expect(png).toBeInstanceOf(Buffer);
		expect(png.length).toBeGreaterThan(0);
		// Check PNG signature
		expect(png[0]).toBe(0x89);
		expect(png[1]).toBe(0x50);
		expect(png[2]).toBe(0x4e);
		expect(png[3]).toBe(0x47);
	});

	it("should generate both SVG and PNG with generate()", () => {
		const qr = new QrBit({ text: "Hello World" });
		const result = qr.generate();

		expect(result).toHaveProperty("svg");
		expect(result).toHaveProperty("png");
		expect(result).toHaveProperty("width");
		expect(result).toHaveProperty("height");

		expect(typeof result.svg).toBe("string");
		expect(result.png).toBeInstanceOf(Buffer);
		expect(result.width).toBe(240);
		expect(result.height).toBe(240);
	});

	it("should support method chaining", () => {
		const qr = new QrBit({ text: "Hello World" });
		qr.size = 300;
		qr.margin = 30;
		qr.backgroundColor = "#FF0000";
		qr.foregroundColor = "#00FF00";

		const result = qr.generate();
		expect(result.width).toBe(360); // 300 + 2*30
		expect(result.height).toBe(360);
	});

	it("should accept custom size and margin", () => {
		const qr = new QrBit({
			text: "Hello World",
			size: 150,
			margin: 10,
		});

		const result = qr.generate();
		expect(result.width).toBe(170); // 150 + 2*10
		expect(result.height).toBe(170);
	});

	it("should accept custom colors", () => {
		const qr = new QrBit({
			text: "Hello World",
			backgroundColor: "#FF0000",
			foregroundColor: "#0000FF",
		});

		const svg = qr.generateSvg();
		expect(svg).toContain("rgb(255,0,0)"); // red background
		expect(svg).toContain("rgb(0,0,255)"); // blue foreground
	});
});

describe("Error Handling", () => {
	it("should handle invalid logo path gracefully", () => {
		const qr = new QrBit({
			text: "Hello World",
			logoPath: "/nonexistent/path/logo.png",
		});

		// Should throw an error when trying to generate
		expect(() => qr.generate()).toThrow();
	});

	it("should handle invalid color formats", () => {
		const qr = new QrBit({
			text: "Hello World",
			backgroundColor: "invalid-color",
		});

		expect(() => qr.generate()).toThrow();
	});

	it("should handle empty text", () => {
		expect(() => new QrBit({ text: "" })).not.toThrow();
	});

	it("should test setLogo with sizeRatio parameter", () => {
		const qr = new QrBit({ text: "Hello World" });
		qr.logoPath = "test.png";
		qr.logoSizeRatio = 0.5;
		expect(qr).toBeInstanceOf(QrBit);
		expect(qr.logoSizeRatio).toBe(0.5);
		expect(qr.logoPath).toBe("test.png");
	});

	it("should generate QR code with logo using testLogoPath", async () => {
		console.log("Using logo path:", testLogoPath);
		const qr = new QrBit({
			text: "https://jaredwray.com",
			logoPath: testLogoPath,
		});

		const result = qr.generate();

		expect(result).toHaveProperty("svg");
		expect(result).toHaveProperty("png");
		expect(result.svg).toContain("<svg");
		expect(result.png).toBeInstanceOf(Buffer);
		expect(result.png?.length).toBeGreaterThan(0);
	});
});

describe("Edge Cases", () => {
	it("should handle very long text", () => {
		const longText = "A".repeat(1000);
		const qr = new QrBit({ text: longText });

		const result = qr.generate();
		expect(result.svg).toContain("<svg");
		expect(result.png).toBeInstanceOf(Buffer);
	});

	it("should handle special characters", () => {
		const specialText =
			"你好 🌍 https://example.com/path?param=value&other=123";
		const qr = new QrBit({ text: specialText });

		const result = qr.generate();
		expect(result.svg).toContain("<svg");
		expect(result.png).toBeInstanceOf(Buffer);
	});

	it("should handle minimum size", () => {
		const qr = new QrBit({
			text: "Hi",
			size: 50,
			margin: 0,
		});

		const result = qr.generate();
		expect(result.width).toBe(50);
		expect(result.height).toBe(50);
	});
});
