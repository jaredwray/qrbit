import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Cacheable } from "cacheable";
import { describe, expect, it } from "vitest";
import { type MosaicOptions, type MosaicStyle, QrBit } from "../src/qrbit";

const testLogoPath = "test/fixtures/test_logo_large.png";
const text = "https://github.com/jaredwray/qrbit";

const svgImage = (body: string, viewBox = "0 0 10 10") =>
	Buffer.from(
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${body}</svg>`,
	);

const square = (fill: string) =>
	svgImage(`<rect width="10" height="10" fill="${fill}"/>`);

const styles: MosaicStyle[] = ["rounded", "dots", "square"];

// Version 12 has 65 modules.
const version = 12;
const modules = 17 + 4 * version;
const size = modules * 10;

/**
 * Read the module grid back from a mosaic SVG. The coordinates of the SVG
 * are in modules. A dark module is inside a subpath of a `<path>`: a run of
 * modules. In the dots style, each dark module is a `<use>` of the shared
 * shape. The fills of inner corners are smaller than a module, so they do
 * not count.
 */
function moduleGrid(svg: string): boolean[][] {
	const grid = Array.from({ length: modules }, () =>
		Array<boolean>(modules).fill(false),
	);
	const mark = (box: number[]) => {
		// A fill of an inner corner is less than half a module wide. Skip it.
		if (box[2] - box[0] < 0.9 || box[3] - box[1] < 0.9) return;
		const [x0, y0, x1, y1] = box.map(Math.round);
		for (let row = y0; row < y1; row++) {
			for (let col = x0; col < x1; col++) {
				grid[row][col] = true;
			}
		}
	};

	for (const [, x, y] of svg.matchAll(/<use [^>]*x="(\d+)" y="(\d+)"/g)) {
		mark([Number(x), Number(y), Number(x) + 1, Number(y) + 1]);
	}

	for (const [, attributes, d] of svg.matchAll(/<path([^>]*) d="([^"]*)"/g)) {
		if (attributes.includes(" id=")) continue;
		const tokens = d.match(/[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)/g) ?? [];
		let [x, y] = [0, 0];
		let box = [0, 0, 0, 0];
		const extend = () => {
			box = [
				Math.min(box[0], x),
				Math.min(box[1], y),
				Math.max(box[2], x),
				Math.max(box[3], y),
			];
		};
		for (let i = 0; i < tokens.length; i++) {
			switch (tokens[i]) {
				case "M":
					x = Number(tokens[++i]);
					y = Number(tokens[++i]);
					box = [x, y, x, y];
					break;
				case "h":
					x += Number(tokens[++i]);
					extend();
					break;
				case "v":
					y += Number(tokens[++i]);
					extend();
					break;
				case "a":
					// Each arc is a quarter circle, so its end points bound it.
					i += 5;
					x += Number(tokens[++i]);
					y += Number(tokens[++i]);
					extend();
					break;
				case "z":
					mark(box);
					break;
				default:
					throw new Error(`Unexpected path token ${tokens[i]}`);
			}
		}
	}
	return grid;
}

/**
 * Fraction of dark modules in the rows [from, to) and the columns
 * [colFrom, colTo), which are the same rows by default.
 */
function darkRatio(
	grid: boolean[][],
	from: number,
	to: number,
	colFrom = from,
	colTo = to,
): number {
	let dark = 0;
	for (let row = from; row < to; row++) {
		for (let col = colFrom; col < colTo; col++) {
			dark += grid[row][col] ? 1 : 0;
		}
	}
	return dark / ((to - from) * (colTo - colFrom));
}

async function renderGrid(mosaic: Omit<MosaicOptions, "version">) {
	const qr = new QrBit({ text, size, mosaic: { version, ...mosaic } });
	return moduleGrid(await qr.toSvg({ cache: false }));
}

async function decodeSvg(svg: string) {
	return QrBit.decodeDetailed(QrBit.convertSvgToPng(svg));
}

/** The distinct fill colors of the shapes in an SVG. */
function fillColors(svg: string): string[] {
	return [
		...new Set([...svg.matchAll(/fill="(rgb\([^"]*\))"/g)].map((m) => m[1])),
	];
}

/** Luminance from 0 to 1 of an `rgb(r,g,b)` color. */
function luminance(color: string): number {
	const [r, g, b] = color.match(/\d+/g)?.map(Number) ?? [];
	return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
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

	it.each(styles)("decodes with the %s style", async (style) => {
		const qr = new QrBit({
			text,
			size: 400,
			mosaic: { image: "test/fixtures/mosaic_petals.svg", style },
		});
		const svg = await qr.toSvg();
		expect((await decodeSvg(svg)).data).toBe(text);
		// Each style has its own shapes: shared dots, or rectangles with
		// round corners (arcs) or without.
		expect(svg.includes("<use ")).toBe(style === "dots");
		expect(/a[\d.]/.test(svg)).toBe(style !== "square");
	});

	it("uses version 14 and error correction L by default", async () => {
		const qr = new QrBit({ text, mosaic: { image: square("#000") } });
		const result = await decodeSvg(await qr.toSvg());
		expect(result.version).toBe(14);
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

	const invalid: [string, object, RegExp][] = [
		["version", { version: 41 }, /version must be from 1 to 40/],
		["sizeRatio", { sizeRatio: 0 }, /sizeRatio must be more than 0/],
		[
			"style",
			{ style: "fancy" },
			/style must be "rounded", "dots" or "square"/,
		],
		["color", { color: "rainbow" }, /color must be "image" or "foreground"/],
	];
	it.each(invalid)("rejects an invalid %s", async (_, options, message) => {
		const qr = new QrBit({
			text,
			mosaic: { image: square("#000"), ...options } as MosaicOptions,
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

	it.each(styles)(
		"draws an opaque dark image with dark modules in the centered area (%s)",
		async (style) => {
			// sizeRatio 0.5 of 65 modules gives a 33 module area at offset 16.
			const grid = await renderGrid({
				image: square("#000"),
				sizeRatio: 0.5,
				style,
			});
			expect(darkRatio(grid, 16, 49)).toBeGreaterThan(0.9);
			// Outside the area, the modules are QR data noise.
			expect(darkRatio(grid, 9, 15)).toBeGreaterThan(0.2);
			expect(darkRatio(grid, 9, 15)).toBeLessThan(0.8);
			// The finder pattern is a dark 7 by 7 ring around a dark 3 by 3 center.
			expect(darkRatio(grid, 0, 7)).toBeCloseTo((49 - 25 + 9) / 49);
			expect(darkRatio(grid, 1, 6)).toBeCloseTo(9 / 25);
			expect(darkRatio(grid, 2, 5)).toBe(1);
		},
	);

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

	it("draws a strong light color with dark modules", async () => {
		// Yellow has a high luminance but no blue, so it is not white.
		const grid = await renderGrid({ image: square("#FFD600"), sizeRatio: 0.5 });
		expect(darkRatio(grid, 16, 49)).toBeGreaterThan(0.9);
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

	it("draws the modules in the colors of the image", async () => {
		// Red covers more of the image than blue, so the modules outside the
		// image are red. The transparent gap between the two areas keeps the
		// colors apart in the modules. The two colors have a near luminance,
		// so they do not change.
		const qr = new QrBit({
			text,
			size,
			mosaic: {
				image: svgImage(
					`<rect width="5" height="10" fill="#E53935"/><rect x="7" width="3" height="10" fill="#1E78C8"/>`,
				),
				version,
				sizeRatio: 0.5,
			},
		});
		const svg = await qr.toSvg();
		expect(fillColors(svg).sort()).toEqual([
			"rgb(229,57,53)",
			"rgb(255,255,255)",
			"rgb(30,120,200)",
		]);
		// Red is the base color under the clip of the shapes, so the finder
		// patterns are red. Blue covers only its modules.
		// The top row of the finder pattern is one run with sharp corners.
		expect(svg).toMatch(
			/<clipPath id="qrbit-mosaic-[0-9a-f]{16}"><path d="[^"]*M0 0h7v1h-7z/,
		);
		expect(svg).toMatch(
			/<g clip-path="url\(#qrbit-mosaic-[0-9a-f]{16}\)"><rect [^>]*fill="rgb\(229,57,53\)"/,
		);
		const grid = moduleGrid(svg);
		expect(grid[0].slice(0, 8)).toEqual([...Array(7).fill(true), false]);
		// The image is 33 modules wide at offset 16, so one image unit is
		// 3.3 modules. Red covers columns 16 to 32 and blue covers columns
		// 40 to 48.
		expect(darkRatio(grid, 18, 47, 17, 32)).toBeGreaterThan(0.9);
		expect(darkRatio(grid, 18, 47, 40, 48)).toBeGreaterThan(0.9);
		expect((await decodeSvg(svg)).data).toBe(text);
	});

	it("makes a light image color darker so that it reads as dark", async () => {
		const qr = new QrBit({ text, mosaic: { image: square("#FFD600") } });
		const svg = await qr.toSvg();
		const [color] = fillColors(svg).filter((c) => c !== "rgb(255,255,255)");
		const [r, g, b] = color.match(/\d+/g)?.map(Number) ?? [];
		// The luminance is at least 0.55 below the white background, plus the
		// rounding of the channels to whole numbers.
		expect(luminance(color)).toBeLessThanOrEqual(0.45 + 1 / 255);
		// The hue stays yellow.
		expect(r).toBeGreaterThan(g);
		expect(b).toBe(0);
		expect((await decodeSvg(svg)).data).toBe(text);
	});

	it("makes a dark image color lighter on a dark background", async () => {
		const qr = new QrBit({
			text,
			backgroundColor: "#000000",
			mosaic: { image: square("#000") },
		});
		const svg = await qr.toSvg();
		const [color] = fillColors(svg).filter((c) => c !== "rgb(0,0,0)");
		expect(luminance(color)).toBeGreaterThanOrEqual(0.55 - 1 / 255);
		expect((await decodeSvg(svg)).data).toBe(text);
	});

	it("keeps the module colors in a small luminance range", async () => {
		// Black covers more of the image than yellow. Yellow becomes a dark
		// yellow near the luminance of black, so that a decoder does not set
		// its threshold between the two colors.
		const qr = new QrBit({
			text,
			mosaic: {
				image: svgImage(
					`<rect width="5" height="10" fill="#000"/><rect x="7" width="3" height="10" fill="#FFD600"/>`,
				),
			},
		});
		const svg = await qr.toSvg();
		const colors = fillColors(svg).filter((c) => c !== "rgb(255,255,255)");
		expect(colors).toContain("rgb(0,0,0)");
		expect(colors).toHaveLength(2);
		const yellow = colors.find((c) => c !== "rgb(0,0,0)") as string;
		const [r, g, b] = yellow.match(/\d+/g)?.map(Number) ?? [];
		expect(luminance(yellow)).toBeLessThanOrEqual(0.08 + 1 / 255);
		expect(r).toBeGreaterThan(g);
		expect(g).toBeGreaterThan(b);
		expect((await decodeSvg(svg)).data).toBe(text);
	});

	it("uses the foreground color when the image has no dark area", async () => {
		const qr = new QrBit({
			text,
			foregroundColor: "#445566",
			mosaic: { image: svgImage("") },
		});
		expect(fillColors(await qr.toSvg())).toEqual([
			"rgb(255,255,255)",
			"rgb(68,85,102)",
		]);
	});

	it("draws all modules in the foreground color with color foreground", async () => {
		const qr = new QrBit({
			text,
			backgroundColor: "#112233",
			foregroundColor: "#445566",
			mosaic: { image: square("#E53935"), color: "foreground" },
		});
		expect(fillColors(await qr.toSvg())).toEqual([
			"rgb(17,34,51)",
			"rgb(68,85,102)",
		]);
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
			{ version: 12 },
			{ errorCorrection: "M" as const },
			{ style: "dots" as const },
			{ color: "foreground" as const },
		]) {
			qr.mosaic = { image: testLogoPath, ...change };
			keys.add(await qr.generateCacheKey("napi-mosaic-svg"));
		}
		expect(keys.size).toBe(9);

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
