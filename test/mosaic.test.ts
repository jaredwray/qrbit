import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Cacheable } from "cacheable";
import { describe, expect, it } from "vitest";
import { type MosaicOptions, QrBit } from "../src/qrbit";

const testLogoPath = "test/fixtures/test_logo_large.png";
const text = "https://github.com/jaredwray/qrbit";

const svgImage = (body: string, viewBox = "0 0 10 10") =>
	Buffer.from(
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${body}</svg>`,
	);

const square = (fill: string) =>
	svgImage(`<rect width="10" height="10" fill="${fill}"/>`);

// Version 12 has 65 modules, so a size of 650 gives 10 pixels per module.
const version = 12;
const modules = 17 + 4 * version;
const size = modules * 10;

/**
 * Read the module grid back from a mosaic SVG. Dark modules are drawn as
 * `M{x} {y}h{w}v{h}h{-w}z` runs in pixel units.
 */
function moduleGrid(svg: string): boolean[][] {
	const total = Number(/<svg[^>]* width="([\d.]+)"/.exec(svg)?.[1]);
	const margin = (total - size) / 2;
	const grid = Array.from({ length: modules }, () =>
		Array<boolean>(modules).fill(false),
	);
	for (const [, x, y, w] of svg.matchAll(/M([\d.]+) ([\d.]+)h([\d.]+)v/g)) {
		const row = Math.round((Number(y) - margin) / 10);
		const col = Math.round((Number(x) - margin) / 10);
		for (let i = 0; i < Math.round(Number(w) / 10); i++) {
			grid[row][col + i] = true;
		}
	}
	return grid;
}

/** Fraction of dark modules in the square [from, to) of rows and columns. */
function darkRatio(grid: boolean[][], from: number, to: number): number {
	let dark = 0;
	for (let row = from; row < to; row++) {
		for (let col = from; col < to; col++) {
			dark += grid[row][col] ? 1 : 0;
		}
	}
	return dark / (to - from) ** 2;
}

async function renderGrid(mosaic: Omit<MosaicOptions, "version">) {
	const qr = new QrBit({ text, size, mosaic: { version, ...mosaic } });
	return moduleGrid(await qr.toSvg({ cache: false }));
}

async function decodeSvg(svg: string) {
	return QrBit.decodeDetailed(QrBit.convertSvgToPng(svg));
}

describe("Mosaic QR codes", () => {
	it.each([
		["SVG bytes", square("#000")],
		["a PNG file path", testLogoPath],
		["PNG bytes", fs.readFileSync(testLogoPath)],
	])("decodes to the exact text with an image from %s", async (_, image) => {
		for (const value of [text, "HELLO WORLD 123", "0123456789"]) {
			const qr = new QrBit({ text: value, mosaic: { image } });
			const result = await decodeSvg(await qr.toSvg());
			expect(result.valid).toBe(true);
			expect(result.data).toBe(value);
		}
	});

	it("decodes as PNG, JPEG and WebP output", async () => {
		const qr = new QrBit({ text, size: 400, mosaic: { image: testLogoPath } });
		for (const buffer of [
			await qr.toPng(),
			await qr.toJpg(),
			await qr.toWebp(),
		]) {
			expect((await QrBit.decodeDetailed(buffer)).data).toBe(text);
		}
	});

	it("uses version 12 and error correction L by default", async () => {
		const qr = new QrBit({ text, mosaic: { image: square("#000") } });
		const result = await decodeSvg(await qr.toSvg());
		expect(result.version).toBe(12);
		expect(result.ecl).toBe("L");
	});

	it("uses the version and error correction from the mosaic options", async () => {
		const qr = new QrBit({
			text,
			size: 500,
			errorCorrection: "H",
			mosaic: { image: square("#000"), version: 15, errorCorrection: "M" },
		});
		const result = await decodeSvg(await qr.toSvg());
		expect(result.version).toBe(15);
		expect(result.ecl).toBe("M");
	});

	it("raises the version when the text needs more space", async () => {
		const long = `${text}?q=${"x".repeat(300)}`;
		const qr = new QrBit({
			text: long,
			size: 600,
			mosaic: { image: square("#000"), version: 1 },
		});
		const result = await decodeSvg(await qr.toSvg());
		expect(result.data).toBe(long);
		expect(result.version).toBeGreaterThan(1);
	});

	it.each([
		["version", { version: 41 }, /version must be from 1 to 40/],
		["sizeRatio", { sizeRatio: 0 }, /sizeRatio must be more than 0/],
	])("rejects an invalid %s", async (_, options, message) => {
		const qr = new QrBit({
			text,
			mosaic: { image: square("#000"), ...options },
		});
		await expect(qr.toSvg()).rejects.toThrow(message);
	});

	it("rejects image bytes that are not a supported image", async () => {
		const qr = new QrBit({
			text,
			mosaic: { image: Buffer.from("not an image") },
		});
		await expect(qr.toSvg()).rejects.toThrow(/Unsupported mosaic image format/);
	});

	it("draws an opaque dark image with dark modules in the centered area", async () => {
		// sizeRatio 0.5 of 65 modules gives a 33 module area at offset 16.
		const grid = await renderGrid({ image: square("#000"), sizeRatio: 0.5 });
		expect(darkRatio(grid, 16, 49)).toBeGreaterThan(0.9);
		// Outside the area, the modules are QR data noise.
		expect(darkRatio(grid, 9, 15)).toBeGreaterThan(0.2);
		expect(darkRatio(grid, 9, 15)).toBeLessThan(0.8);
	});

	it("draws a GIF image", async () => {
		// A 1 by 1 GIF with one opaque white pixel. A transparent or failed
		// image would give noise, not light modules.
		const gif = Buffer.from(
			"R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
			"base64",
		);
		const grid = await renderGrid({ image: gif, sizeRatio: 0.5 });
		expect(darkRatio(grid, 16, 49)).toBeLessThan(0.1);
	});

	it("does not load local files that an SVG image links to", async () => {
		// A remote SVG must not read files on the server. If the linked
		// black PNG loads, the area becomes dark instead of QR noise.
		const black = path.join(os.tmpdir(), `qrbit-mosaic-${process.pid}.png`);
		fs.writeFileSync(black, QrBit.convertSvgToPng(square("#000").toString()));
		try {
			const grid = await renderGrid({
				image: svgImage(`<image href="${black}" width="10" height="10"/>`),
				sizeRatio: 0.5,
			});
			expect(darkRatio(grid, 16, 49)).toBeLessThan(0.8);
		} finally {
			fs.rmSync(black);
		}
	});

	it("draws an opaque light image with light modules", async () => {
		const grid = await renderGrid({ image: square("#fff"), sizeRatio: 0.5 });
		expect(darkRatio(grid, 16, 49)).toBeLessThan(0.1);
	});

	it("leaves transparent parts of the image to the QR data", async () => {
		const warnings: string[] = [];
		const qr = new QrBit({
			text,
			size,
			mosaic: { image: svgImage(""), version, sizeRatio: 0.5 },
		});
		qr.on("warn", (message: string) => warnings.push(message));
		const ratio = darkRatio(moduleGrid(await qr.toSvg()), 16, 49);
		expect(ratio).toBeGreaterThan(0.2);
		expect(ratio).toBeLessThan(0.8);
		expect(warnings).toEqual([]);
	});

	it("puts light modules around a dark shape on a transparent image", async () => {
		// A 30 by 30 image at 30 modules maps one image unit to one module.
		// The dark square covers modules 27 to 36.
		const grid = await renderGrid({
			image: svgImage(
				`<rect x="10" y="10" width="10" height="10" fill="#000"/>`,
				"0 0 30 30",
			),
			sizeRatio: 30 / modules,
		});
		expect(darkRatio(grid, 27, 37)).toBeGreaterThan(0.85);

		let light = 0;
		let ring = 0;
		for (let i = 26; i <= 37; i++) {
			for (const [row, col] of [
				[26, i],
				[37, i],
				[i, 26],
				[i, 37],
			]) {
				ring++;
				light += grid[row][col] ? 0 : 1;
			}
		}
		expect(light / ring).toBeGreaterThan(0.9);
	});

	it("uses the threshold to select dark and light modules", async () => {
		const grey = square("#808080");
		const below = await renderGrid({
			image: grey,
			sizeRatio: 0.5,
			threshold: 0.4,
		});
		const above = await renderGrid({
			image: grey,
			sizeRatio: 0.5,
			threshold: 0.6,
		});
		expect(darkRatio(below, 16, 49)).toBeLessThan(0.1);
		expect(darkRatio(above, 16, 49)).toBeGreaterThan(0.9);
	});

	it("draws the image in the foreground and background colors", async () => {
		const qr = new QrBit({
			text,
			backgroundColor: "#112233",
			foregroundColor: "#445566",
			mosaic: { image: square("#000") },
		});
		const svg = await qr.toSvg();
		expect(svg).toContain('fill="rgb(17,34,51)"');
		expect(svg).toContain('fill="rgb(68,85,102)"');
	});

	it("warns when the image is too large for the version", async () => {
		const warnings: string[] = [];
		const qr = new QrBit({
			text,
			mosaic: {
				image: square("#000"),
				version: 3,
				errorCorrection: "H",
				sizeRatio: 1,
			},
		});
		qr.on("warn", (message: string) => warnings.push(message));
		const result = await decodeSvg(await qr.toSvg());
		expect(result.data).toBe(text);
		expect(warnings).toHaveLength(1);
		expect(warnings[0]).toMatch(
			/^The mosaic image matched only \d+ of \d+ modules\. Use a higher version or a smaller sizeRatio\.$/,
		);
	});

	it("does not warn when the image fits the version", async () => {
		const warnings: string[] = [];
		const qr = new QrBit({ text, mosaic: { image: testLogoPath } });
		qr.on("warn", (message: string) => warnings.push(message));
		await qr.toSvg();
		expect(warnings).toEqual([]);
	});

	it("ignores the logo option with a warning", async () => {
		const warnings: string[] = [];
		const qr = new QrBit({
			text,
			logo: testLogoPath,
			mosaic: { image: square("#000") },
		});
		qr.on("warn", (message: string) => warnings.push(message));
		const svg = await qr.toSvg();
		expect(svg).not.toContain("<image");
		expect(warnings).toEqual([
			"The mosaic option ignores the logo option, because a logo covers data modules.",
		]);
	});

	it("renders a standard QR code without caching it when the image file is missing", async () => {
		const errors: string[] = [];
		const qr = new QrBit({
			text,
			mosaic: { image: "/non/existent/mosaic.png" },
		});
		qr.on("error", (message: string) => errors.push(message));

		const svg = await qr.toSvg();
		await qr.toSvg();

		expect((await decodeSvg(svg)).data).toBe(text);
		expect(errors).toHaveLength(2);
		expect(errors[0]).toMatch(
			/^Mosaic image could not be loaded: .*mosaic\.png.*\. Proceeding without mosaic\.$/,
		);
	});

	it.each(["toPng", "toJpg", "toWebp"] as const)(
		"does not cache the %s output of a failed mosaic",
		async (method) => {
			const errors: string[] = [];
			const qr = new QrBit({
				text,
				mosaic: { image: "/non/existent/mosaic.png" },
			});
			qr.on("error", (message: string) => errors.push(message));

			const buffer = await qr[method]();
			await qr[method]();

			expect((await QrBit.decodeDetailed(buffer)).data).toBe(text);
			expect(errors).toHaveLength(2);
		},
	);

	it("caches the mosaic SVG", async () => {
		const cache = new Cacheable();
		const qr = new QrBit({ text, cache, mosaic: { image: square("#000") } });
		const svg = await qr.toSvg();
		const key = await qr.generateCacheKey("napi-mosaic-svg");
		expect(await cache.get(key)).toBe(svg);
		expect(await qr.toSvg()).toBe(svg);
	});

	it("changes the cache key when a mosaic option changes", async () => {
		const qr = new QrBit({ text, mosaic: { image: testLogoPath } });
		const keys = new Set<string>();
		keys.add(await qr.generateCacheKey("napi-mosaic-svg"));
		for (const change of [
			{ image: square("#000") },
			{ image: new URL("https://example.com/") },
			{ sizeRatio: 0.5 },
			{ threshold: 0.3 },
			{ version: 14 },
			{ errorCorrection: "M" as const },
		]) {
			qr.mosaic = { image: testLogoPath, ...change };
			keys.add(await qr.generateCacheKey("napi-mosaic-svg"));
		}
		expect(keys.size).toBe(7);

		qr.mosaic = undefined;
		expect(keys.has(await qr.generateCacheKey("napi-mosaic-svg"))).toBe(false);
	});

	it("gives the same cache key for URL images with the same address", async () => {
		const first = new QrBit({
			text,
			mosaic: { image: new URL("https://example.com/") },
		});
		const second = new QrBit({
			text,
			mosaic: { image: new URL("https://example.com/") },
		});
		expect(await first.generateCacheKey("napi-mosaic-svg")).toBe(
			await second.generateCacheKey("napi-mosaic-svg"),
		);
	});

	it("gets and sets the mosaic options", () => {
		const qr = new QrBit({ text });
		expect(qr.mosaic).toBeUndefined();
		const mosaic = { image: testLogoPath, version: 10 };
		qr.mosaic = mosaic;
		expect(qr.mosaic).toBe(mosaic);
	});
});
