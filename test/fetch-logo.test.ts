import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { Cacheable } from "cacheable";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { QrBit } from "../src/qrbit";

type Route = {
	body?: string | Buffer;
	status?: number;
	redirect?: string;
	delay?: number;
};

const png = fs.readFileSync("test/fixtures/test_logo_small.png");

// An ICO file with one PNG image, the usual format of favicon.ico.
const ico = Buffer.concat([
	Buffer.from([0, 0, 1, 0, 1, 0]),
	Buffer.from([0, 0, 0, 0, 1, 0, 32, 0]),
	Buffer.from(Uint32Array.of(png.length, 22).buffer),
	png,
]);

const svg = Buffer.from(
	'<?xml version="1.0"?>\n<!-- logo -->\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>',
);

// Routes are keyed by path, or by host and path for one server only.
let routes: Record<string, Route> = {};
let hits: Record<string, number> = {};
let requests: string[] = [];
let base = "";
let other = "";

const handle: http.RequestListener = (request, response) => {
	const path = new URL(request.url ?? "/", "http://localhost").pathname;
	hits[path] = (hits[path] ?? 0) + 1;
	requests.push(`${request.headers.host}${request.url}`);
	const route = routes[`${request.headers.host}${path}`] ?? routes[path];
	const send = () => {
		if (!route) {
			response.writeHead(404).end("not found");
		} else if (route.redirect) {
			response.writeHead(302, { location: route.redirect }).end();
		} else {
			response.writeHead(route.status ?? 200).end(route.body);
		}
	};
	if (route?.delay) {
		setTimeout(send, route.delay);
	} else {
		send();
	}
};

const server = http.createServer(handle);
const otherServer = http.createServer(handle);

async function listen(target: http.Server): Promise<string> {
	await new Promise<void>((resolve) => target.listen(0, "127.0.0.1", resolve));
	return `http://127.0.0.1:${(target.address() as AddressInfo).port}`;
}

const html = (head: string) =>
	`<!doctype html><html><head>${head}</head></html>`;

beforeAll(async () => {
	base = await listen(server);
	other = await listen(otherServer);
});

afterAll(() => {
	for (const target of [server, otherServer]) {
		target.closeAllConnections();
		target.close();
	}
});

beforeEach(() => {
	routes = {};
	hits = {};
	requests = [];
});

describe("QrBit.fetchLogo", () => {
	it("returns the image when the URL is an image", async () => {
		routes["/logo.png"] = { body: png };
		expect(await QrBit.fetchLogo(`${base}/logo.png`)).toEqual(png);
	});

	it.each([
		["JPEG", Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])],
		["GIF", Buffer.from("GIF89a....")],
		["WebP", Buffer.from("RIFF\0\0\0\0WEBPVP8 ")],
		["ICO", ico],
		["SVG", svg],
	])("recognizes a %s image", async (_, body) => {
		routes["/image"] = { body };
		expect(await QrBit.fetchLogo(new URL(`${base}/image`))).toEqual(body);
	});

	it.each([
		["a RIFF file that is not WebP", Buffer.from("RIFF\0\0\0\0WAVEfmt ")],
		[
			"an HTML page with an inline SVG",
			Buffer.from(`${html("")}<svg viewBox="0 0 1 1"></svg>`),
		],
	])("does not accept %s as an image", async (_, body) => {
		routes["/"] = { body };
		await expect(QrBit.fetchLogo(`${base}/`)).rejects.toThrow(
			`No logo found for ${base}/`,
		);
	});

	it("selects the largest icon from the page", async () => {
		routes["/"] = {
			body: html(`
				<link rel="stylesheet" href="/style.css">
				<link href="/norel.png" sizes="999x999">
				<link rel="icon">
				<link rel=icon href=/tiny.png>
				<link rel='apple-touch-icon' href='/touch.png'>
				<link rel="icon" sizes="32x32 512x512" href="/big.png">
			`),
		};
		for (const path of [
			"/tiny.png",
			"/touch.png",
			"/big.png",
			"/style.css",
			"/norel.png",
		]) {
			routes[path] = { body: png };
		}
		await QrBit.fetchLogo(base);
		expect(hits["/big.png"]).toBe(1);
		expect(hits["/touch.png"]).toBeUndefined();
		expect(hits["/style.css"]).toBeUndefined();
		expect(hits["/norel.png"]).toBeUndefined();
	});

	it("selects an apple-touch-icon before a small icon", async () => {
		routes["/"] = {
			body: html(`
				<link rel="icon" href="/tiny.png">
				<link rel="apple-touch-icon" href="/touch.png">
			`),
		};
		routes["/tiny.png"] = { body: png };
		routes["/touch.png"] = { body: png };
		await QrBit.fetchLogo(base);
		expect(hits["/touch.png"]).toBe(1);
		expect(hits["/tiny.png"]).toBeUndefined();
	});

	it.each([
		["an SVG type", '<link rel="icon" type="image/svg+xml" href="/vector">'],
		["an .svg file name", '<link rel="icon" href="/vector.svg">'],
		["sizes any", '<link rel="icon" sizes="any" href="/vector">'],
	])("selects an icon with %s first", async (_, link) => {
		routes["/"] = {
			body: html(`<link rel="icon" sizes="512x512" href="/big.png">${link}`),
		};
		routes["/big.png"] = { body: png };
		routes["/vector"] = { body: svg };
		routes["/vector.svg"] = { body: svg };
		expect(await QrBit.fetchLogo(base)).toEqual(svg);
		expect(hits["/big.png"]).toBeUndefined();
	});

	it("skips icons that fail and icon links that are not valid URLs", async () => {
		routes["/"] = {
			body: html(`
				<link rel="icon" sizes="512x512" href="http://[bad">
				<link rel="icon" sizes="256x256" href="/missing.png">
				<link rel="icon" sizes="128x128" href="/page.html">
				<link rel="icon" sizes="64x64" href="/good.png">
			`),
		};
		routes["/page.html"] = { body: html("") };
		routes["/good.png"] = { body: png };
		expect(await QrBit.fetchLogo(base)).toEqual(png);
		expect(hits["/missing.png"]).toBe(1);
		expect(hits["/page.html"]).toBe(1);
	});

	it("resolves relative icon links against the address after redirects", async () => {
		routes["/"] = { redirect: "/home/" };
		routes["/home/"] = { body: html('<link rel="icon" href="icon.png">') };
		routes["/home/icon.png"] = { body: png };
		expect(await QrBit.fetchLogo(base)).toEqual(png);
	});

	it("decodes character references in icon links", async () => {
		routes["/"] = {
			body: html(`
				<link rel="icon" sizes="64x64" href="/named?a=1&amp;b=2">
				<link rel="icon" sizes="48x48" href="/decimal?c=3&#38;d=4">
				<link rel="icon" sizes="32x32" href="/hex?e=5&#x26;f=6">
			`),
		};
		routes["/hex"] = { body: png };
		expect(await QrBit.fetchLogo(base)).toEqual(png);
		const host = new URL(base).host;
		expect(requests).toEqual([
			`${host}/`,
			`${host}/named?a=1&b=2`,
			`${host}/decimal?c=3&d=4`,
			`${host}/hex?e=5&f=6`,
		]);
	});

	it("uses the site after a redirect to another host for the fallback icons", async () => {
		const otherHost = new URL(other).host;
		routes["/"] = { redirect: `${other}/` };
		routes[`${otherHost}/`] = { body: html("") };
		routes[`${otherHost}/favicon.ico`] = { body: ico };
		expect(await QrBit.fetchLogo(base)).toEqual(ico);
		expect(requests).toContain(`${otherHost}/favicon.ico`);
	});

	it("falls back to /apple-touch-icon.png and then /favicon.ico", async () => {
		routes["/"] = { body: html("") };
		routes["/apple-touch-icon.png"] = { body: png };
		expect(await QrBit.fetchLogo(base)).toEqual(png);

		delete routes["/apple-touch-icon.png"];
		routes["/favicon.ico"] = { body: ico };
		expect(await QrBit.fetchLogo(base)).toEqual(ico);
	});

	it("ignores a response that is larger than maxBytes", async () => {
		routes["/"] = { body: html("") };
		routes["/apple-touch-icon.png"] = {
			body: Buffer.concat([png, Buffer.alloc(4096)]),
		};
		routes["/favicon.ico"] = { body: ico };
		expect(await QrBit.fetchLogo(base, { maxBytes: ico.length })).toEqual(ico);
	});

	it("ignores a response that takes longer than the timeout", async () => {
		routes["/"] = { body: png, delay: 500 };
		routes["/favicon.ico"] = { body: ico };
		expect(await QrBit.fetchLogo(base, { timeout: 50 })).toEqual(ico);
	});

	it("rejects when no image is found", async () => {
		await expect(QrBit.fetchLogo(`${base}/nothing/here`)).rejects.toThrow(
			`No logo found for ${base}/nothing/here`,
		);
		expect(hits["/apple-touch-icon.png"]).toBe(1);
		expect(hits["/favicon.ico"]).toBe(1);
	});

	it("rejects URLs that are not http or https", async () => {
		await expect(QrBit.fetchLogo("file:///etc/passwd")).rejects.toThrow(
			"Only http and https URLs are supported: file:///etc/passwd",
		);
	});
});

describe("Mosaic QR codes with a URL image", () => {
	it("draws the fetched logo and keeps it in the cache", async () => {
		routes["/"] = { body: html('<link rel="icon" href="/logo.svg">') };
		routes["/logo.svg"] = { body: svg };
		const cache = new Cacheable();
		const image = new URL(`${base}/`);

		const first = new QrBit({ text: "first", cache, mosaic: { image } });
		const second = new QrBit({ text: "second", cache, mosaic: { image } });
		for (const qr of [first, second]) {
			const result = await QrBit.decodeDetailed(await qr.toPng());
			expect(result.data).toBe(qr.text);
		}
		expect(hits["/logo.svg"]).toBe(1);
	});

	it("draws a favicon.ico logo", async () => {
		routes["/"] = { body: html("") };
		routes["/favicon.ico"] = { body: ico };
		const errors: string[] = [];
		const qr = new QrBit({
			text: "favicon",
			mosaic: { image: new URL(`${base}/`) },
		});
		qr.on("error", (message: string) => errors.push(message));
		const result = await QrBit.decodeDetailed(await qr.toPng());
		expect(result.data).toBe("favicon");
		expect(errors).toEqual([]);
	});

	it("fetches the logo again when the cache is off", async () => {
		routes["/logo.png"] = { body: png };
		const qr = new QrBit({
			text: "no cache",
			cache: false,
			mosaic: { image: new URL(`${base}/logo.png`) },
		});
		await qr.toSvg();
		await qr.toSvg();
		expect(hits["/logo.png"]).toBe(2);
	});

	it("renders a standard QR code when no logo is found", async () => {
		const errors: string[] = [];
		const qr = new QrBit({
			text: "no logo",
			mosaic: { image: new URL(`${base}/`) },
		});
		qr.on("error", (message: string) => errors.push(message));
		const result = await QrBit.decodeDetailed(await qr.toPng());
		expect(result.data).toBe("no logo");
		expect(errors).toEqual([
			`Mosaic image could not be loaded: No logo found for ${base}/. Proceeding without mosaic.`,
		]);
	});
});
