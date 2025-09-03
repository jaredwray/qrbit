import { describe, expect, it } from "vitest";
import { generatePng, generateQr, generateSvg, QrBit } from "../src/qrbit";

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
		const qr = new QrBit({ text: "Hello World" })
			.setSize(300)
			.setMargin(30)
			.setColors("#FF0000", "#00FF00");

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

describe("Convenience Functions", () => {
	it("should generate QR with generateQr function", () => {
		const result = generateQr({ text: "Test Message" });

		expect(result).toHaveProperty("svg");
		expect(result).toHaveProperty("png");
		expect(result).toHaveProperty("width");
		expect(result).toHaveProperty("height");
	});

	it("should generate SVG with generateSvg function", () => {
		const svg = generateSvg("Test Message");

		expect(typeof svg).toBe("string");
		expect(svg).toContain("<svg");
		expect(svg).toContain("</svg>");
	});

	it("should generate PNG with generatePng function", () => {
		const png = generatePng("Test Message");

		expect(png).toBeInstanceOf(Buffer);
		expect(png.length).toBeGreaterThan(0);
	});

	it("should accept options in convenience functions", () => {
		const svg = generateSvg("Test Message", {
			size: 100,
			margin: 5,
			backgroundColor: "#FFFF00",
		});

		expect(svg).toContain('width="110"'); // 100 + 2*5
		expect(svg).toContain("rgb(255,255,0)"); // yellow background
	});

	it("should generate PNG with generatePng function and custom options", () => {
		const png = generatePng("Test Message", {
			size: 150,
			margin: 15,
			backgroundColor: "#FF0000",
			foregroundColor: "#0000FF",
		});

		expect(png).toBeInstanceOf(Buffer);
		expect(png.length).toBeGreaterThan(0);
		// Check PNG signature
		expect(png[0]).toBe(0x89);
		expect(png[1]).toBe(0x50);
		expect(png[2]).toBe(0x4e);
		expect(png[3]).toBe(0x47);
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
		const result = qr.setLogo("test.png", 0.5);
		expect(result).toBeInstanceOf(QrBit);
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
